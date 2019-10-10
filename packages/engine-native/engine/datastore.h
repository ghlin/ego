#pragma once

#include <cstdint>
#include <napi.h>
#include <map>

namespace ny {

// mind the order...
struct Record
{
  std::uint32_t code;
  std::uint32_t alias;
  std::uint64_t setcode;
  std::uint32_t type;
  std::uint32_t level;
  std::uint32_t attribute;
  std::uint32_t race;
  std::int32_t  attack;
  std::int32_t  defense;
  std::uint32_t lscale;
  std::uint32_t rscale;
  std::uint32_t link_marker;
};

class DataStore : public Napi::ObjectWrap<DataStore>
{
  std::map<std::uint32_t, Record> by_code;

public:
  using Napi::ObjectWrap<DataStore>::ObjectWrap;

public:
  Napi::Value add(Napi::CallbackInfo const &info);
  Napi::Value get(Napi::CallbackInfo const &info);
  Napi::Value keys(Napi::CallbackInfo const &info);

public:
  std::map<std::uint32_t, Record> const &records() const;

public:
  static Napi::Function initialize(Napi::Env &);
  static Napi::FunctionReference constructor;
};

} // namespace ny

