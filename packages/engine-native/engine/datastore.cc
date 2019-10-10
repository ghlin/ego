#include "datastore.h"
#include "misc.h"

namespace ny {

Napi::Value DataStore::add(const Napi::CallbackInfo &info)
{
  auto env   = info.Env();
  auto scope = Napi::HandleScope(env);

  REQUIRE_N_ARGS(info, 1);
  GET_ARG_OF_TYPE(info, 0, Object);

  GET_INTEGER_PROPERTY(arg0, code,        Uint32);
  GET_INTEGER_PROPERTY(arg0, alias,       Uint32);
  GET_INTEGER_PROPERTY(arg0, type,        Uint32);
  GET_INTEGER_PROPERTY(arg0, level,       Uint32);
  GET_INTEGER_PROPERTY(arg0, attribute,   Uint32);
  GET_INTEGER_PROPERTY(arg0, race,        Uint32);
  GET_INTEGER_PROPERTY(arg0, attack,      Int32);
  GET_INTEGER_PROPERTY(arg0, defense,     Int32);
  GET_INTEGER_PROPERTY(arg0, lscale,      Uint32);
  GET_INTEGER_PROPERTY(arg0, rscale,      Uint32);
  GET_INTEGER_PROPERTY(arg0, link_marker, Uint32);

  // SETCODE? as string.
  auto setcodeObj = arg0.Get("setcode");
  REQUIRE_OF_TYPE(setcodeObj, String);
  auto setcode = std::stoull(setcodeObj.As<Napi::String>().Utf8Value());

  Record record;

  record.code        = code;
  record.alias       = alias;
  record.setcode     = setcode;
  record.type        = type;
  record.level       = level;
  record.attribute   = attribute;
  record.race        = race;
  record.attack      = attack;
  record.defense     = defense;
  record.lscale      = lscale;
  record.rscale      = rscale;
  record.link_marker =link_marker;

  auto status = by_code.insert(std::make_pair(code, record));

  return Napi::Boolean::New(env, status.second);
}

Napi::Value DataStore::get(Napi::CallbackInfo const &info)
{
  auto env   = info.Env();
  auto scope = Napi::HandleScope(env);

  REQUIRE_N_ARGS(info, 1);
  GET_ARG_OF_TYPE(info, 0, Number);

  auto code = arg0.Uint32Value();

  auto found = by_code.find(code);
  if (found == by_code.end()) {
    return Napi::Value();
  }

  auto const &record = found->second;
  auto card          = Napi::Object::New(env);

  card.Set("code",        record.code);
  card.Set("alias",       record.alias);
  card.Set("level",       record.level);
  card.Set("race",        record.race);
  card.Set("type",        record.type);
  card.Set("attack",      record.attack);
  card.Set("defense",     record.defense);
  card.Set("lscale",      record.lscale);
  card.Set("rscale",      record.rscale);
  card.Set("attribute",   record.attribute);
  card.Set("link_marker", record.link_marker);

  card.Set("setcode", std::to_string(record.setcode));

  return card;
}

Napi::Value DataStore::keys(Napi::CallbackInfo const &info)
{
  auto env   = info.Env();
  auto scope = Napi::HandleScope(env);

  auto keys = Napi::Array::New(env);
  for (auto const &pair: by_code) {
    keys.Set(keys.Length(), pair.first);
  }

  return keys;
}


std::map<std::uint32_t, Record> const &DataStore::records() const
{
  return by_code;
}

Napi::FunctionReference DataStore::constructor;

Napi::Function DataStore::initialize(Napi::Env &env)
{
  auto klass = DataStore::DefineClass( env
                                     , "DataStore"
                                     , { DataStore::InstanceMethod("add", &DataStore::add)
                                       , DataStore::InstanceMethod("get", &DataStore::get)
                                       , DataStore::InstanceMethod("keys", &DataStore::keys)
                                       }
                                     );
  DataStore::constructor = Napi::Persistent(klass);
  DataStore::constructor.SuppressDestruct();

  return klass;
}

} // namespace ny

