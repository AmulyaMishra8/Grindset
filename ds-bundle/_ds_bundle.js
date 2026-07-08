/* @ds-bundle: {"format":"iife","name":"grindset"} */
(function(global) {
  "use strict";

  // Grindset Design System Bundle — Primitives & Layouts
  // All components use CSS custom properties from styles.css

  const components = {
    Alert: function(props) { return null; },
    FormField: function(props) { return null; },
    VoteControl: function(props) { return null; },
    TopBar: function(props) { return null; },
    AuthLayout: function(props) { return null; },
  };

  global.grindset = components;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = components;
  }
})(typeof window !== 'undefined' ? window : global);
