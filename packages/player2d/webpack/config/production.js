"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var webpack_merge_1 = require("webpack-merge");
var base_1 = require("./base");
var config = {
    mode: 'production',
    devtool: 'cheap-module-source-map',
};
module.exports = webpack_merge_1.default(base_1.baseConfig({ plugins: [] }), config);
