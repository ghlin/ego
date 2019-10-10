#pragma once

#include <cstdint>
#include <napi.h>
#include <map>

namespace ny {

class ScriptStore : public Napi::ObjectWrap<ScriptStore>
{
  std::map<std::string, std::string> by_filename;

public:
  std::map<std::string, std::string> const &scripts() const;

public:
  Napi::Value add(Napi::CallbackInfo const &info);

public:
  static Napi::Function initialize(Napi::Env &);
  static Napi::FunctionReference constructor;

  using Napi::ObjectWrap<ScriptStore>::ObjectWrap;
};

} // namespace ny
