#pragma once

#include <cstdint>
#include <string>
#include <memory>
#include <napi.h>

namespace ny {

/**
 * taken from ocgcore.
 */
using byte = unsigned char;

/**
 * taken from ocgcore, the `ptr' type.
 */
using duel_ptr_t = long;

extern "C" {

#define DEFINE_API_PROTOTYPE(name, ret, ...) typedef ret (* name##_t)(__VA_ARGS__)

DEFINE_API_PROTOTYPE( create_duel
                    , duel_ptr_t
                    , std::uint32_t);

DEFINE_API_PROTOTYPE( start_duel
                    , void
                    , duel_ptr_t, std::int32_t);

DEFINE_API_PROTOTYPE( end_duel
                    , void
                    , duel_ptr_t);

DEFINE_API_PROTOTYPE( set_player_info
                    , void
                    , duel_ptr_t, std::int32_t, std::int32_t, std::int32_t, std::int32_t);

DEFINE_API_PROTOTYPE( get_log_message
                    , void
                    , duel_ptr_t, byte *);

DEFINE_API_PROTOTYPE( get_message
                    , std::int32_t
                    , duel_ptr_t, byte *);

DEFINE_API_PROTOTYPE( process
                    , std::int32_t
                    , duel_ptr_t);

DEFINE_API_PROTOTYPE( new_card
                    , void
                    , duel_ptr_t, std::uint32_t, std::uint8_t, std::uint8_t, std::uint8_t, std::uint8_t, std::uint8_t);

DEFINE_API_PROTOTYPE( new_tag_card
                    , void
                    , duel_ptr_t, std::uint32_t, std::uint8_t, std::uint8_t);

DEFINE_API_PROTOTYPE( query_card
                    , std::int32_t
                    , duel_ptr_t, std::uint8_t, std::uint8_t, std::uint8_t, std::int32_t, byte *, std::int32_t);

DEFINE_API_PROTOTYPE( query_field_count
                    , std::int32_t
                    , duel_ptr_t, std::uint8_t, std::uint8_t);

DEFINE_API_PROTOTYPE( query_field_card
                    , std::int32_t
                    , duel_ptr_t, std::uint8_t, std::uint8_t, std::int32_t, byte *, std::int32_t);

DEFINE_API_PROTOTYPE( query_field_info
                    , std::int32_t
                    , duel_ptr_t, byte *);

DEFINE_API_PROTOTYPE( set_responsei
                    , void
                    , duel_ptr_t, std::int32_t);

DEFINE_API_PROTOTYPE( set_responseb
                    , void
                    , duel_ptr_t, byte *);

DEFINE_API_PROTOTYPE( preload_script
                    , std::int32_t
                    , duel_ptr_t, char const*, std::int32_t);

DEFINE_API_PROTOTYPE( default_script_reader
                    , byte *
                    , char const *, int *);

DEFINE_API_PROTOTYPE( default_card_reader
                    , std::uint32_t
                    , std::uint32_t, void *);

DEFINE_API_PROTOTYPE( default_message_handler
                    , std::uint32_t
                    , void *, std::uint32_t);

DEFINE_API_PROTOTYPE( script_reader
                    , byte *
                    , char const *, int *);

DEFINE_API_PROTOTYPE( card_reader
                    , std::uint32_t
                    , std::uint32_t, void *);

DEFINE_API_PROTOTYPE( set_script_reader
                    , void
                    , script_reader_t);

DEFINE_API_PROTOTYPE( set_card_reader
                    , void
                    , card_reader_t);

#undef  DEFINE_API_PROTOTYPE
}

class CoreAPI
{
  void *dylib_handler = nullptr;

  friend bool initialize_core_api(CoreAPI *core_api, char const *path);

public:
  ~CoreAPI();

public:
  void release();

public:
#define DEFINE_API_SLOT(name) name##_t name = nullptr

DEFINE_API_SLOT(create_duel);
DEFINE_API_SLOT(start_duel);
DEFINE_API_SLOT(end_duel);
DEFINE_API_SLOT(set_player_info);
DEFINE_API_SLOT(get_log_message);
DEFINE_API_SLOT(get_message);
DEFINE_API_SLOT(process);
DEFINE_API_SLOT(new_card);
DEFINE_API_SLOT(new_tag_card);
DEFINE_API_SLOT(query_card);
DEFINE_API_SLOT(query_field_count);
DEFINE_API_SLOT(query_field_card);
DEFINE_API_SLOT(query_field_info);
DEFINE_API_SLOT(set_responsei);
DEFINE_API_SLOT(set_responseb);
DEFINE_API_SLOT(preload_script);
DEFINE_API_SLOT(set_card_reader);
DEFINE_API_SLOT(set_script_reader);

#undef  DEFINE_API_SLOT
};

class DataStore;
class ScriptStore;

class CoreEngine : public Napi::ObjectWrap<CoreEngine>
{
public:
  struct Wrapper;

private:
  std::unique_ptr<Wrapper>  wrapper;
  std::unique_ptr<CoreAPI>  api;

  DataStore                *data_store   = nullptr;
  ScriptStore              *script_store = nullptr;

public:
  CoreEngine(Napi::CallbackInfo const &info);

  DataStore   const *get_data_store()   const;
  ScriptStore const *get_script_store() const;

public:
  Napi::Value      createDuel(Napi::CallbackInfo const &info);
  Napi::Value       startDuel(Napi::CallbackInfo const &info);
  Napi::Value         endDuel(Napi::CallbackInfo const &info);
  Napi::Value   setPlayerInfo(Napi::CallbackInfo const &info);
  Napi::Value   getLogMessage(Napi::CallbackInfo const &info);
  Napi::Value         process(Napi::CallbackInfo const &info);
  Napi::Value         newCard(Napi::CallbackInfo const &info);
  Napi::Value      newTagCard(Napi::CallbackInfo const &info);
  Napi::Value       queryCard(Napi::CallbackInfo const &info);
  Napi::Value queryFieldCount(Napi::CallbackInfo const &info);
  Napi::Value  queryFieldCard(Napi::CallbackInfo const &info);
  Napi::Value  queryFieldInfo(Napi::CallbackInfo const &info);
  Napi::Value     setResponse(Napi::CallbackInfo const &info);
  Napi::Value   preloadScript(Napi::CallbackInfo const &info);

public:
  Napi::Value bindData(Napi::CallbackInfo const &info);
  Napi::Value bindScript(Napi::CallbackInfo const &info);

public:
  static Napi::Function initialize(Napi::Env &);
  static Napi::FunctionReference constructor;
};

} // namespace ny
