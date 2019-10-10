#include "scriptstore.h"
#include "misc.h"

namespace ny {

Napi::Value ScriptStore::add(const Napi::CallbackInfo &info)
{
  auto env   = info.Env();
  auto scope = Napi::HandleScope(env);

  REQUIRE_N_ARGS(info, 2);
  GET_ARG_OF_TYPE(info, 0, String);
  GET_ARG_OF_TYPE(info, 1, String);

  auto filename = arg0.Utf8Value();
  auto content  = arg1.Utf8Value();

  by_filename[filename] = content;

  return Napi::Value();
}

std::map<std::string, std::string> const &ScriptStore::scripts() const
{
  return by_filename;
}

Napi::FunctionReference ScriptStore::constructor;

Napi::Function ScriptStore::initialize(Napi::Env &env)
{
  auto klass = ScriptStore::DefineClass( env
                                       , "ScriptStore"
                                       , { ScriptStore::InstanceMethod("add", &ScriptStore::add) });
  ScriptStore::constructor = Napi::Persistent(klass);
  ScriptStore::constructor.SuppressDestruct();

  return klass;
}

} // namespace ny

