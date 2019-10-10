#pragma once

#define GET_INTEGER_PROPERTY(obj, key, sb)                                                                          \
  auto $field_##key = (obj).Get(#key);                                                                              \
  if (!$field_##key.IsNumber())                                                                                     \
  {                                                                                                                 \
    std::fprintf(stderr, "engine-native: %s, %d, %s: Integer expected (%s)\n", __FILE__, __LINE__, __func__, #key); \
    Napi::TypeError::New(env, "Error: Integer expected").ThrowAsJavaScriptException();                              \
  }                                                                                                                 \
  auto key = $field_##key.As<Napi::Number>().sb##Value()

#define GET_ARG_OF_TYPE(obj, n, type) \
  REQUIRE_OF_TYPE((obj)[n], type);    \
  auto arg##n = (obj)[n].As<Napi::type>()


#define REQUIRE_OF_TYPE(obj, type)                                                         \
  do {                                                                                     \
    if (!(obj).Is##type()) {                                                               \
      std::fprintf( stderr                                                                 \
                  , "engine-native: %s, %d, %s: " #type " expected"                        \
                  , __FILE__                                                               \
                  , __LINE__                                                               \
                  , __func__);                                                             \
      Napi::TypeError::New(env, "Error: " #type " expected").ThrowAsJavaScriptException(); \
    }                                                                                      \
  } while (false)

#define REQUIRE_N_ARGS(info, n)                                                                                      \
  do {                                                                                                               \
    if ((info).Length() != n) {                                                                                      \
      std::fprintf( stderr                                                                                           \
                  , "engine-native: %s, %d, %s: requires %d arguments, got %zu\n"                                    \
                  , __FILE__                                                                                         \
                  , __LINE__                                                                                         \
                  , __func__                                                                                         \
                  , (n)                                                                                              \
                  , (info).Length());                                                                                \
      Napi::TypeError::New(env, "Error: " + std::to_string(n) + " arguments expected").ThrowAsJavaScriptException(); \
    }                                                                                                                \
  } while (false)
