{
  "targets": [
    {
      "target_name": "enginewrapper",
      "sources": [
        "engine/main.cc",
        "engine/datastore.cc",
        "engine/scriptstore.cc",
        "engine/coreapi.cc"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "defines": ["NAPI_DISABLE_CPP_EXCEPTIONS"]
    }
  ]
}
