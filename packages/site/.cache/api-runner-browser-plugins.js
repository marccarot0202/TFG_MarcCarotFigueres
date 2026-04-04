module.exports = [{
      plugin: require('../../../node_modules/gatsby-plugin-styled-components/gatsby-browser.js'),
      options: {"plugins":[],"displayName":true,"fileName":true,"minify":true,"namespace":"","transpileTemplateLiterals":true,"topLevelImportPaths":[],"pure":false,"disableVendorPrefixes":false},
    },{
      plugin: require('../../../node_modules/gatsby-plugin-manifest/gatsby-browser.js'),
      options: {"plugins":[],"name":"Template Snap","icon":"src/assets/logo.svg","theme_color":"#6F4CFF","background_color":"#FFFFFF","display":"standalone","legacy":true,"theme_color_in_head":true,"cache_busting_mode":"query","crossOrigin":"anonymous","include_favicon":true,"cacheDigest":"80f001a0d61fe8748ba7f8e7aec97c23"},
    },{
      plugin: require('../gatsby-browser.tsx'),
      options: {"plugins":[]},
    },{
      plugin: require('../../../node_modules/gatsby/dist/internal-plugins/partytown/gatsby-browser.js'),
      options: {"plugins":[]},
    }]
