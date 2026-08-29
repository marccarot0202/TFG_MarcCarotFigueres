module.exports = [{
      plugin: require('../../../node_modules/gatsby-plugin-styled-components/gatsby-browser.js'),
      options: {"plugins":[],"displayName":true,"fileName":true,"minify":true,"namespace":"","transpileTemplateLiterals":true,"topLevelImportPaths":[],"pure":false,"disableVendorPrefixes":false},
    },{
      plugin: require('../../../node_modules/gatsby-plugin-manifest/gatsby-browser.js'),
      options: {"plugins":[],"name":"Assistent de Seguretat Web3","icon":"src/assets/logo.svg","theme_color":"#6F4CFF","background_color":"#FFFFFF","display":"standalone","legacy":true,"theme_color_in_head":true,"cache_busting_mode":"query","crossOrigin":"anonymous","include_favicon":true,"cacheDigest":"39694e9b04b72af4c6ec4b5a9aa62ee3"},
    },{
      plugin: require('../gatsby-browser.tsx'),
      options: {"plugins":[]},
    },{
      plugin: require('../../../node_modules/gatsby/dist/internal-plugins/partytown/gatsby-browser.js'),
      options: {"plugins":[]},
    }]
