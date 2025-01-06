const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const { type } = require('os');

module.exports = {
    entry: {
        popup: path.resolve('src/popup/popup.tsx'),
        options: path.resolve('src/options/options.tsx'),
        offscreen: path.resolve('src/offscreen/offscreen.tsx'),
        welcome: path.resolve('src/welcome/welcome.tsx'),
        background: path.resolve('src/background/background.ts'),
        contentScript: path.resolve('src/contentScript/contentScript.ts')
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
            {
                test: /\.css$/i,
                use: ['style-loader', 'css-loader'],
            },
            {
                type: 'assets/resource',
                test: /\.(png|svg|jpg|jpeg|gif)$/,
            }
        ],
    },
    plugins : [
        new CleanWebpackPlugin({
            cleanStaleWebpackAssets: false
        }),
        new CopyPlugin({
            patterns: [
                { 
                    from: path.resolve('src/static'),
                    to: path.resolve('dist') 
                },
            ],
        }),
        ...getHtmlPlugins(['popup', 'options', 'offscreen', 'welcome'])
    ],
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
    },
    output: {
        filename: '[name].js',
        path: path.resolve('dist'),
    },
    optimization: {
        splitChunks: {
            chunks: 'all'
        }
    }
}

function getHtmlPlugins(chnks) {
    return chnks.map(chunk => {
        return new HtmlWebpackPlugin({
            title: 'Meet-Track-AI',
            filename: `${chunk}.html`,
            chunks: [chunk]
        })
    })
}