#include "coreapi.h"
#include "datastore.h"
#include "scriptstore.h"
#include "misc.h"
#include <map>
#include <uv.h>

namespace ny {

#define TRACEF(...)                                               \
  do { std::fprintf(stderr, " *** %s, %d: ", __func__, __LINE__); \
       std::fprintf(stderr, __VA_ARGS__);                         \
       std::fprintf(stderr, "\n"); } while (false)

static
void finalizer(void *, void *buffer)
{
  // TRACEF("finalizer called");
  delete []static_cast<byte *>(buffer);
}

static
byte *read_script_from_current_engine( char const *script_name
                                     , int        *script_length);

static
std::uint32_t read_card_from_current_engine(std::uint32_t code, void *data);

bool initialize_core_api(CoreAPI *core_api, char const *path)
{
  auto dylib_handler = new uv_lib_t;
  if (uv_dlopen(path, dylib_handler)) {
    TRACEF("uv_dlopen failed: %s", uv_dlerror(dylib_handler));
    uv_dlclose(dylib_handler);
    delete dylib_handler;
    return false;
  }

  core_api->dylib_handler = dylib_handler;

#define SETUP_API_SLOT(name) do {                               \
    auto symref = reinterpret_cast<void **>(&core_api->name);   \
    if (uv_dlsym(dylib_handler, #name, symref)) {               \
      TRACEF("uv_dlsym failed: %s", uv_dlerror(dylib_handler)); \
      TRACEF("           note: lib path is %s", path);          \
      TRACEF("                 symbol is   "  #name);           \
      uv_dlclose(dylib_handler);                                \
      delete dylib_handler;                                     \
      return false;                                             \
    }                                                           \
  } while (false)

  SETUP_API_SLOT(create_duel);
  SETUP_API_SLOT(start_duel);
  SETUP_API_SLOT(end_duel);
  SETUP_API_SLOT(set_player_info);
  SETUP_API_SLOT(get_log_message);
  SETUP_API_SLOT(get_message);
  SETUP_API_SLOT(process);
  SETUP_API_SLOT(new_card);
  SETUP_API_SLOT(new_tag_card);
  SETUP_API_SLOT(query_card);
  SETUP_API_SLOT(query_field_count);
  SETUP_API_SLOT(query_field_card);
  SETUP_API_SLOT(query_field_info);
  SETUP_API_SLOT(set_responsei);
  SETUP_API_SLOT(set_responseb);
  SETUP_API_SLOT(preload_script);
  SETUP_API_SLOT(set_script_reader);
  SETUP_API_SLOT(set_card_reader);
#undef  SETUP_API_SLOT

  core_api->set_script_reader(read_script_from_current_engine);
  core_api->set_card_reader(read_card_from_current_engine);

  return true;
}

void CoreAPI::release()
{
  if (dylib_handler) {
    auto lib = reinterpret_cast<uv_lib_t *>(dylib_handler);
    uv_dlclose(lib);
    delete lib;
  }
}

CoreAPI::~CoreAPI()
{
  release();
}

auto open_ocgcore(std::string const &path)
{
  auto core_api_ref = std::make_unique<CoreAPI>();
  return initialize_core_api(core_api_ref.get(), path.c_str())
    ? std::move(core_api_ref)
    : nullptr;
}

static /* thread_local ? */
CoreEngine *g_current_engine = nullptr;

static
std::uint32_t read_card_from_current_engine(std::uint32_t code, void *data)
{
  if (!g_current_engine) {
    TRACEF("read_card: current engine not set");
    return 1;
  }

  auto data_store = g_current_engine->get_data_store();
  auto found      = data_store->records().find(code);
  if (found == data_store->records().end()) {
    TRACEF("read_card: card %u not found", code);
    return 1;
  }
  *static_cast<Record *>(data) = found->second;
  return 0;
}

static
byte *try_script( char const *script_name
                , int        *script_length)
{
  auto script_store = g_current_engine->get_script_store();
  auto found        = script_store->scripts().find(script_name);
  if (found == script_store->scripts().end()) {
    return nullptr;
  }

  *script_length = found->second.size();

  return reinterpret_cast<byte *>(
    const_cast<char *>(found->second.data()));
}

static
byte *read_script_from_current_engine( char const *script_name
                                     , int        *script_length)
{
  if (!g_current_engine) {
    TRACEF("read_script: current engine not set");
    return nullptr;
  }

  if (auto found = try_script(script_name, script_length)) {
    return found;
  }

  for (char const *probe_script_name = script_name; *probe_script_name; ++probe_script_name) {
    if (probe_script_name[0] != '/') continue;
    if (auto found = try_script(probe_script_name + 1, script_length)) {
      return found;
    }
  }

  *script_length = 0;
  static byte dummy_script_content[1] = { 0 };

  return dummy_script_content;
}

#define switch_engine()                \
  do {                                 \
    g_current_engine = this;           \
  } while (false)

using duel_instance_id_t = std::uint32_t;

DataStore   const *CoreEngine::get_data_store()   const { return data_store;   }
ScriptStore const *CoreEngine::get_script_store() const { return script_store; }

struct CoreEngine::Wrapper
{
  std::map<duel_instance_id_t, duel_ptr_t> duel_ptr_by_id;
  duel_instance_id_t                       last_id;

  duel_instance_id_t acquire(duel_ptr_t duel)
  {
    auto id = ++last_id;
    duel_ptr_by_id.insert({ id, duel });
    return id;
  }

  duel_ptr_t lookup(duel_instance_id_t id) const
  {
    auto found = duel_ptr_by_id.find(id);
    if (found == duel_ptr_by_id.end()) {
      return 0;
    }
    return found->second;
  }

  void release(duel_instance_id_t id)
  {
    duel_ptr_by_id.erase(id);
  }
};

CoreEngine::CoreEngine(Napi::CallbackInfo const &info)
  : Napi::ObjectWrap<CoreEngine>(info)
  , wrapper(std::make_unique<CoreEngine::Wrapper>())
{
  auto env   = info.Env();
  auto scope = Napi::HandleScope(env);

  REQUIRE_N_ARGS(info, 1);
  GET_ARG_OF_TYPE(info, 0, String);

  auto path = arg0.Utf8Value();

  api = open_ocgcore(path);
}

Napi::Value CoreEngine::bindData(Napi::CallbackInfo const &info)
{
  auto env   = info.Env();
  auto scope = Napi::HandleScope(env);

  REQUIRE_N_ARGS(info, 1);
  GET_ARG_OF_TYPE(info, 0, Object);

  data_store = DataStore::Unwrap(arg0);

  return Napi::Value();
}

Napi::Value CoreEngine::bindScript(Napi::CallbackInfo const &info)
{
  auto env   = info.Env();
  auto scope = Napi::HandleScope(env);

  REQUIRE_N_ARGS(info, 1);
  GET_ARG_OF_TYPE(info, 0, Object);

  script_store = ScriptStore::Unwrap(arg0);

  return Napi::Value();
}

#define CHECK_DUEL(n)                                                                 \
  GET_ARG_OF_TYPE(info, n, Number);                                                   \
  auto duel_id = arg0.Uint32Value();                                                  \
  auto duel = wrapper->lookup(duel_id);                                               \
  if (duel) {} else                                                                   \
    Napi::TypeError::New(env, "Error: Number expected").ThrowAsJavaScriptException()

#define CHECK_INT(n, name, ty)      \
  GET_ARG_OF_TYPE(info, n, Number); \
  auto name = arg##n.ty()

Napi::Value CoreEngine::createDuel(Napi::CallbackInfo const &info)
{
  auto env   = info.Env();
  auto scope = Napi::HandleScope(env);

  REQUIRE_N_ARGS(info, 1);
  CHECK_INT(0, seed, Uint32Value);

  switch_engine();
  auto duel = api->create_duel(seed);

  return Napi::Value::From(env, wrapper->acquire(duel));
}


Napi::Value CoreEngine::startDuel(Napi::CallbackInfo const &info)
{
  auto env   = info.Env();
  auto scope = Napi::HandleScope(env);

  REQUIRE_N_ARGS(info, 2);
  CHECK_DUEL(0);
  CHECK_INT(1, options, Int32Value);

  switch_engine();
  api->start_duel(duel, options);

  return Napi::Value();
}


Napi::Value CoreEngine::endDuel(Napi::CallbackInfo const &info)
{
  auto env   = info.Env();
  auto scope = Napi::HandleScope(env);

  REQUIRE_N_ARGS(info, 1);
  CHECK_DUEL(0);

  switch_engine();
  api->end_duel(duel);
  wrapper->release(duel_id);

  return Napi::Value();
}

Napi::Value CoreEngine::setPlayerInfo(Napi::CallbackInfo const &info)
{
  auto env   = info.Env();
  auto scope = Napi::HandleScope(env);

  REQUIRE_N_ARGS(info, 2);
  CHECK_DUEL(0);
  GET_ARG_OF_TYPE(info, 1, Object);

  GET_INTEGER_PROPERTY(arg1, player, Int32);
  GET_INTEGER_PROPERTY(arg1, lp,     Int32);
  GET_INTEGER_PROPERTY(arg1, start,  Int32);
  GET_INTEGER_PROPERTY(arg1, draw,   Int32);

  switch_engine();

  api->set_player_info(duel, player, lp, start, draw);

  return Napi::Value();
}

Napi::Value CoreEngine::getLogMessage(Napi::CallbackInfo const &info)
{
  // TODO: move this to CoreEngine::process. 2019-09-28 21:27:06
  auto env   = info.Env();
  auto scope = Napi::HandleScope(env);

  REQUIRE_N_ARGS(info, 1);
  CHECK_DUEL(0);

  switch_engine();

  // void get_log_message(ptr pduel, byte* buf) {
  //   strcpy((char*)buf, ((duel*)pduel)->strbuffer);
  // }
  // strbuffer: char [256]
  char message_buffer[256] = "";
  api->get_log_message(duel, reinterpret_cast<byte *>(message_buffer));

  return Napi::Value::From(env, message_buffer);
}

Napi::Value CoreEngine::process(Napi::CallbackInfo const &info)
{
  auto env   = info.Env();
  auto scope = Napi::HandleScope(env);

  REQUIRE_N_ARGS(info, 1);
  CHECK_DUEL(0);

  switch_engine();

  auto const process_result = api->process(duel);
  auto const message_length = process_result &  0xFFFF;
  auto const process_flags  = process_result >> 16;

  auto message_buff = new byte[0x1000];
  api->get_message(duel, message_buff);

  auto buffer_object = Napi::ArrayBuffer::New(env, message_buff, message_length, finalizer);
  auto result_array  = Napi::Array::New(env, 2);

  result_array.Set(0u, buffer_object);
  result_array.Set(1,  Napi::Value::From(env, process_flags));

  return result_array;
}

Napi::Value CoreEngine::newCard(Napi::CallbackInfo const &info)
{
  auto env   = info.Env();
  auto scope = Napi::HandleScope(env);

  REQUIRE_N_ARGS(info, 2);
  CHECK_DUEL(0);
  GET_ARG_OF_TYPE(info, 1, Object);

  GET_INTEGER_PROPERTY(arg1, code,     Uint32);
  GET_INTEGER_PROPERTY(arg1, owner,    Uint32);
  GET_INTEGER_PROPERTY(arg1, player,   Uint32);
  GET_INTEGER_PROPERTY(arg1, location, Uint32);
  GET_INTEGER_PROPERTY(arg1, sequence, Uint32);
  GET_INTEGER_PROPERTY(arg1, position, Uint32);

  switch_engine();

  api->new_card(duel, code, owner, player, location, sequence, position);

  return Napi::Value();
}

Napi::Value CoreEngine::queryCard(Napi::CallbackInfo const &info)
{
  auto env   = info.Env();
  auto scope = Napi::HandleScope(env);

  REQUIRE_N_ARGS(info, 2);
  CHECK_DUEL(0);
  GET_ARG_OF_TYPE(info, 1, Object);

  GET_INTEGER_PROPERTY(arg1, player,   Uint32);
  GET_INTEGER_PROPERTY(arg1, location, Uint32);
  GET_INTEGER_PROPERTY(arg1, flags,    Uint32);
  GET_INTEGER_PROPERTY(arg1, sequence, Uint32);
  auto cache_property = arg1.Get("cache");
  REQUIRE_OF_TYPE(cache_property, Boolean);
  auto cache = cache_property.As<Napi::Boolean>().Value();

  switch_engine();

  auto query_buffer = new byte[0x4000];
  auto buffer_length = api->query_card(duel, player, location, sequence, flags, query_buffer, cache);

  return Napi::ArrayBuffer::New(env, query_buffer, buffer_length, finalizer);
}

Napi::Value CoreEngine::queryFieldCount(Napi::CallbackInfo const &info)
{
  auto env   = info.Env();
  auto scope = Napi::HandleScope(env);

  REQUIRE_N_ARGS(info, 3);
  CHECK_DUEL(0);
  CHECK_INT(1, player, Uint32Value);
  CHECK_INT(2, location, Uint32Value);

  switch_engine();

  return Napi::Value::From(env, api->query_field_count(duel, player, location));
}

Napi::Value CoreEngine::queryFieldCard(Napi::CallbackInfo const &info)
{
  auto env   = info.Env();
  auto scope = Napi::HandleScope(env);

  REQUIRE_N_ARGS(info, 2);
  CHECK_DUEL(0);
  GET_ARG_OF_TYPE(info, 1, Object);

  GET_INTEGER_PROPERTY(arg1, player, Uint32);
  GET_INTEGER_PROPERTY(arg1, location, Uint32);
  GET_INTEGER_PROPERTY(arg1, flags, Uint32);
  auto cache_property = arg1.Get("cache");
  REQUIRE_OF_TYPE(cache_property, Boolean);
  auto cache = cache_property.As<Napi::Boolean>().Value();

  switch_engine();

  auto query_buffer = new byte[0x4000];
  auto buffer_length = api->query_field_card(duel, player, location, flags, query_buffer, cache);

  return Napi::ArrayBuffer::New(env, query_buffer, buffer_length, finalizer);
}

Napi::Value CoreEngine::setResponse(Napi::CallbackInfo const &info)
{
  auto env   = info.Env();
  auto scope = Napi::HandleScope(env);

  REQUIRE_N_ARGS(info, 2);
  CHECK_DUEL(0);
  GET_ARG_OF_TYPE(info, 1, ArrayBuffer);

  if (arg1.ByteLength() > 64) {
    TRACEF("ByteLength: %zu", arg1.ByteLength());
    Napi::RangeError::New(env, "response buffer is too large (> 64 bytes)").ThrowAsJavaScriptException();
  }

  byte response_buffer[64];
  std::memcpy(response_buffer, arg1.Data(), 64);

  switch_engine();
  api->set_responseb(duel, response_buffer);

  return Napi::Value();
}

#define NOT_IMPLEMENTED(x)                                                                 \
  Napi::Value CoreEngine::x(Napi::CallbackInfo const &info)                     \
  {                                                                             \
    auto env   = info.Env();                                                    \
    auto scope = Napi::HandleScope(env);                                        \
    Napi::Error::New(env, #x ": not implemented").ThrowAsJavaScriptException(); \
    return Napi::Value();                                                       \
  }

NOT_IMPLEMENTED(  preloadScript)
NOT_IMPLEMENTED(     newTagCard)
NOT_IMPLEMENTED( queryFieldInfo)

#undef  NOT_IMPLEMENTED

Napi::FunctionReference CoreEngine::constructor;

Napi::Function CoreEngine::initialize(Napi::Env &env)
{
#define METHOD(x) CoreEngine::InstanceMethod(#x, &CoreEngine::x)
  auto klass = CoreEngine::DefineClass( env
                                      , "CoreEngine"
                                      , { METHOD(     createDuel)
                                        , METHOD(      startDuel)
                                        , METHOD(        endDuel)
                                        , METHOD(  setPlayerInfo)
                                        , METHOD(  getLogMessage)
                                        , METHOD(        process)
                                        , METHOD(        newCard)
                                        , METHOD(     newTagCard)
                                        , METHOD(      queryCard)
                                        , METHOD(queryFieldCount)
                                        , METHOD( queryFieldCard)
                                        , METHOD( queryFieldInfo)
                                        , METHOD(    setResponse)
                                        , METHOD(  preloadScript)
                                        , METHOD(       bindData)
                                        , METHOD(     bindScript)
                                        }
                                      );
#undef METHOD

  DataStore::constructor = Napi::Persistent(klass);
  DataStore::constructor.SuppressDestruct();

  return klass;
}

} // namespace ny

