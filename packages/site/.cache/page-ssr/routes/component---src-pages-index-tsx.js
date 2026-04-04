"use strict";
exports.id = "component---src-pages-index-tsx";
exports.ids = ["component---src-pages-index-tsx"];
exports.modules = {

/***/ "./src/pages/index.tsx?export=default":
/*!********************************************!*\
  !*** ./src/pages/index.tsx?export=default ***!
  \********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var styled_components__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! styled-components */ "../../node_modules/styled-components/dist/styled-components.esm.js");
/* harmony import */ var _components__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../components */ "./src/components/index.ts");
/* harmony import */ var _config__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../config */ "./src/config/index.ts");
/* harmony import */ var _hooks__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../hooks */ "./src/hooks/index.ts");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../utils */ "./src/utils/index.ts");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react/jsx-runtime */ "../../node_modules/react/jsx-runtime.js");







const Container = styled_components__WEBPACK_IMPORTED_MODULE_5__["default"].div.withConfig({
  displayName: "pages__Container"
})(["display:flex;flex-direction:column;align-items:center;flex:1;margin-top:7.6rem;margin-bottom:7.6rem;", "{padding-left:2.4rem;padding-right:2.4rem;margin-top:2rem;margin-bottom:2rem;width:auto;}"], ({
  theme
}) => theme.mediaQueries.small);
const Heading = styled_components__WEBPACK_IMPORTED_MODULE_5__["default"].h1.withConfig({
  displayName: "pages__Heading"
})(["margin-top:0;margin-bottom:2.4rem;text-align:center;"]);
const Span = styled_components__WEBPACK_IMPORTED_MODULE_5__["default"].span.withConfig({
  displayName: "pages__Span"
})(["color:", ";"], props => {
  var _props$theme$colors$p;
  return (_props$theme$colors$p = props.theme.colors.primary) === null || _props$theme$colors$p === void 0 ? void 0 : _props$theme$colors$p.default;
});
const Subtitle = styled_components__WEBPACK_IMPORTED_MODULE_5__["default"].p.withConfig({
  displayName: "pages__Subtitle"
})(["font-size:", ";font-weight:500;margin-top:0;margin-bottom:0;", "{font-size:", ";}"], ({
  theme
}) => theme.fontSizes.large, ({
  theme
}) => theme.mediaQueries.small, ({
  theme
}) => theme.fontSizes.text);
const CardContainer = styled_components__WEBPACK_IMPORTED_MODULE_5__["default"].div.withConfig({
  displayName: "pages__CardContainer"
})(["display:flex;flex-direction:row;flex-wrap:wrap;justify-content:space-between;max-width:64.8rem;width:100%;height:100%;margin-top:1.5rem;"]);
const Notice = styled_components__WEBPACK_IMPORTED_MODULE_5__["default"].div.withConfig({
  displayName: "pages__Notice"
})(["background-color:", ";border:1px solid ", ";color:", ";border-radius:", ";padding:2.4rem;margin-top:2.4rem;max-width:60rem;width:100%;& > *{margin:0;}", "{margin-top:1.2rem;padding:1.6rem;}"], ({
  theme
}) => {
  var _theme$colors$backgro;
  return (_theme$colors$backgro = theme.colors.background) === null || _theme$colors$backgro === void 0 ? void 0 : _theme$colors$backgro.alternative;
}, ({
  theme
}) => {
  var _theme$colors$border;
  return (_theme$colors$border = theme.colors.border) === null || _theme$colors$border === void 0 ? void 0 : _theme$colors$border.default;
}, ({
  theme
}) => {
  var _theme$colors$text;
  return (_theme$colors$text = theme.colors.text) === null || _theme$colors$text === void 0 ? void 0 : _theme$colors$text.alternative;
}, ({
  theme
}) => theme.radii.default, ({
  theme
}) => theme.mediaQueries.small);
const ErrorMessage = styled_components__WEBPACK_IMPORTED_MODULE_5__["default"].div.withConfig({
  displayName: "pages__ErrorMessage"
})(["background-color:", ";border:1px solid ", ";color:", ";border-radius:", ";padding:2.4rem;margin-bottom:2.4rem;margin-top:2.4rem;max-width:60rem;width:100%;", "{padding:1.6rem;margin-bottom:1.2rem;margin-top:1.2rem;max-width:100%;}"], ({
  theme
}) => {
  var _theme$colors$error;
  return (_theme$colors$error = theme.colors.error) === null || _theme$colors$error === void 0 ? void 0 : _theme$colors$error.muted;
}, ({
  theme
}) => {
  var _theme$colors$error2;
  return (_theme$colors$error2 = theme.colors.error) === null || _theme$colors$error2 === void 0 ? void 0 : _theme$colors$error2.default;
}, ({
  theme
}) => {
  var _theme$colors$error3;
  return (_theme$colors$error3 = theme.colors.error) === null || _theme$colors$error3 === void 0 ? void 0 : _theme$colors$error3.alternative;
}, ({
  theme
}) => theme.radii.default, ({
  theme
}) => theme.mediaQueries.small);
const Index = () => {
  const {
    error
  } = (0,_hooks__WEBPACK_IMPORTED_MODULE_2__.useMetaMaskContext)();
  const {
    isFlask,
    snapsDetected,
    installedSnap
  } = (0,_hooks__WEBPACK_IMPORTED_MODULE_2__.useMetaMask)();
  const requestSnap = (0,_hooks__WEBPACK_IMPORTED_MODULE_2__.useRequestSnap)();
  const invokeSnap = (0,_hooks__WEBPACK_IMPORTED_MODULE_2__.useInvokeSnap)();
  const isMetaMaskReady = (0,_utils__WEBPACK_IMPORTED_MODULE_3__.isLocalSnap)(_config__WEBPACK_IMPORTED_MODULE_1__.defaultSnapOrigin) ? isFlask : snapsDetected;
  const handleSendHelloClick = async () => {
    await invokeSnap({
      method: 'hello'
    });
  };

  // Handler para analizar transacciones con IA
  const handleAnalyzeTransaction = async () => {
    await invokeSnap({
      method: 'analyzeTransaction',
      params: {
        transaction: {
          type: 'approve',
          contract: '0x1234567890abcdef',
          amount: 'unlimited'
        }
      }
    });
  };

  // 🔥 Simular transacción real para probar onTransaction
  const handleSendTransaction = async () => {
    try {
      // Obtener la cuenta actual
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      });
      if (!accounts || accounts.length === 0) {
        console.error('No accounts found');
        return;
      }
      const from = accounts[0];

      // Enviar transacción de prueba (0 ETH a dirección nula)
      await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{
          from: from,
          to: '0x0000000000000000000000000000000000000000',
          value: '0x0',
          // 0 ETH
          data: '0x' // Sin datos
        }]
      });
    } catch (error) {
      console.error('Error:', error);
    }
  };
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)(Container, {
    children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)(Heading, {
      children: ["Welcome to ", /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(Span, {
        children: "template-snap"
      })]
    }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)(Subtitle, {
      children: ["Get started by editing ", /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("code", {
        children: "src/index.tsx"
      })]
    }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)(CardContainer, {
      children: [error && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)(ErrorMessage, {
        children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("b", {
          children: "An error happened:"
        }), " ", error.message]
      }), !isMetaMaskReady && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_components__WEBPACK_IMPORTED_MODULE_0__.Card, {
        content: {
          title: 'Install',
          description: 'Snaps is pre-release software only available in MetaMask Flask, a canary distribution for developers with access to upcoming features.',
          button: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_components__WEBPACK_IMPORTED_MODULE_0__.InstallFlaskButton, {})
        },
        fullWidth: true
      }), !installedSnap && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_components__WEBPACK_IMPORTED_MODULE_0__.Card, {
        content: {
          title: 'Connect',
          description: 'Get started by connecting to and installing the example snap.',
          button: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_components__WEBPACK_IMPORTED_MODULE_0__.ConnectButton, {
            onClick: requestSnap,
            disabled: !isMetaMaskReady
          })
        },
        disabled: !isMetaMaskReady
      }), (0,_utils__WEBPACK_IMPORTED_MODULE_3__.shouldDisplayReconnectButton)(installedSnap) && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_components__WEBPACK_IMPORTED_MODULE_0__.Card, {
        content: {
          title: 'Reconnect',
          description: 'While connected to a local running snap this button will always be displayed in order to update the snap if a change is made.',
          button: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_components__WEBPACK_IMPORTED_MODULE_0__.ReconnectButton, {
            onClick: requestSnap,
            disabled: !installedSnap
          })
        },
        disabled: !installedSnap
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_components__WEBPACK_IMPORTED_MODULE_0__.Card, {
        content: {
          title: 'Send Hello message',
          description: 'Display a custom message within a confirmation screen in MetaMask.',
          button: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_components__WEBPACK_IMPORTED_MODULE_0__.SendHelloButton, {
            onClick: handleSendHelloClick,
            disabled: !installedSnap
          })
        },
        disabled: !installedSnap,
        fullWidth: isMetaMaskReady && Boolean(installedSnap) && !(0,_utils__WEBPACK_IMPORTED_MODULE_3__.shouldDisplayReconnectButton)(installedSnap)
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_components__WEBPACK_IMPORTED_MODULE_0__.Card, {
        content: {
          title: '🔍 Analyze Transaction (AI)',
          description: 'Send a transaction to the backend for AI-powered security analysis using Ollama.',
          button: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_components__WEBPACK_IMPORTED_MODULE_0__.AnalyzeButton, {
            onClick: handleAnalyzeTransaction,
            disabled: !installedSnap
          })
        },
        disabled: !installedSnap,
        fullWidth: isMetaMaskReady && Boolean(installedSnap) && !(0,_utils__WEBPACK_IMPORTED_MODULE_3__.shouldDisplayReconnectButton)(installedSnap)
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_components__WEBPACK_IMPORTED_MODULE_0__.Card, {
        content: {
          title: '💸 Send Test Transaction',
          description: 'Trigger a real transaction to see the Snap intercept it automatically with onTransaction hook.',
          button: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_components__WEBPACK_IMPORTED_MODULE_0__.SendHelloButton, {
            onClick: handleSendTransaction,
            disabled: !installedSnap
          })
        },
        disabled: !installedSnap,
        fullWidth: false
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(Notice, {
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("p", {
          children: ["Please note that the ", /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("b", {
            children: "snap.manifest.json"
          }), " and", ' ', /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("b", {
            children: "package.json"
          }), " must be located in the server root directory and the bundle must be hosted at the location specified by the location field."]
        })
      })]
    })]
  });
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Index);

/***/ })

};
;
//# sourceMappingURL=component---src-pages-index-tsx.js.map