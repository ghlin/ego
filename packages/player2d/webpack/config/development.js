"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
var path_1 = require("path");
var webpack_merge_1 = require("webpack-merge");
var base_1 = require("./base");
var WEBPACK_DEV_SERVER_WS_ADDR = (_a = process.env.HOST_ADDR) !== null && _a !== void 0 ? _a : 'http://localhost:8080';
var config = {
    mode: 'development',
    entry: [
        "webpack-dev-server/client?" + WEBPACK_DEV_SERVER_WS_ADDR,
        //  'webpack/hot/only-dev-server',
        path_1.join(base_1.SRC_ROOT_DIR, 'index.ts')
    ],
    devServer: {
        port: 8080,
        hot: true,
        host: '0.0.0.0',
        disableHostCheck: true,
        stats: 'minimal',
        contentBase: base_1.BASE_DIR,
        publicPath: '/',
        overlay: true,
    }
};
module.exports = webpack_merge_1.default(base_1.baseConfig({ plugins: [] }), config);
