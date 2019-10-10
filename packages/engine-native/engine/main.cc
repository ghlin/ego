#include <napi.h>
#include <string>
#include "datastore.h"
#include "scriptstore.h"
#include "coreapi.h"

Napi::Object Init(Napi::Env env, Napi::Object exports)
{
  using namespace ny;

  Napi::HandleScope scope(env);

  exports.Set("DataStore",   DataStore::initialize(env));
  exports.Set("ScriptStore", ScriptStore::initialize(env));
  exports.Set("CoreEngine",  CoreEngine::initialize(env));

  return exports;
}

NODE_API_MODULE(enginewrapper, Init)


