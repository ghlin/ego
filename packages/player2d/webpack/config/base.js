"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from) {
    for (var i = 0, il = from.length, j = to.length; i < il; i++, j++)
        to[j] = from[i];
    return to;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.baseConfig = exports.SRC_ROOT_DIR = exports.BASE_DIR = void 0;
var path_1 = require("path");
var webpack_1 = require("webpack");
// import * as CopyWebpackPlugin from 'copy-webpack-plugin'
var HTMLWebpackPlugin = require("html-webpack-plugin");
/**
 * project base dir
 */
exports.BASE_DIR = path_1.normalize(path_1.resolve(__dirname, '..', '..'));
/**
 * root of project source files
 */
exports.SRC_ROOT_DIR = path_1.join(exports.BASE_DIR, 'src');
function baseConfig(options) {
    var _a, _b;
    return {
        devtool: 'inline-source-map',
        entry: path_1.join(exports.SRC_ROOT_DIR, 'index.ts'),
        output: {
            path: path_1.join(exports.BASE_DIR, 'dist'),
            filename: 'bundle.js',
            publicPath: ''
        },
        resolve: {
            extensions: ['.js', '.ts', '.jsx', '.tsx', '.json']
        },
        module: {
            rules: [
                {
                    test: /\.(tsx?)/,
                    use: ['ts-loader'],
                    exclude: /node_modules/
                },
                {
                    test: /\.(?:ico|gif|png|jpg|jpeg|webp|bmp)$/,
                    use: ['url-loader']
                }
            ]
        },
        plugins: __spreadArray([
            new webpack_1.DefinePlugin({
                SERVER_URL: "'" + ((_a = process.env.HOST_ADDR) !== null && _a !== void 0 ? _a : 'http://localhost:8080') + "'"
            }),
            new HTMLWebpackPlugin({
                template: path_1.join(exports.SRC_ROOT_DIR, 'index.html'),
                inject: false
            })
        ], ((_b = options.plugins) !== null && _b !== void 0 ? _b : []))
    };
}
exports.baseConfig = baseConfig;
