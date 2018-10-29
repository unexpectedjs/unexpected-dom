module.exports = (elm, selector) => {
  const matchFuntion =
    elm.matchesSelector ||
    elm.mozMatchesSelector ||
    elm.msMatchesSelector ||
    elm.oMatchesSelector ||
    elm.webkitMatchesSelector ||
    function(selector) {
      const node = this;
      const nodes = (node.parentNode || node.document).querySelectorAll(
        selector
      );
      let i = 0;

      while (nodes[i] && nodes[i] !== node) {
        i += 1;
      }

      return !!nodes[i];
    };

  return matchFuntion.call(elm, selector);
};
