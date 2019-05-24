; var nav = (function(w, d, undefined) {

  "use strict";

  var init = function() {
    var pathname = window.location.pathname;
    pathname = pathname.split("/");
    var $obj = $(".nav-link[data-slug*='" + pathname[1] + "']").addClass('active');

  };

  d.addEventListener('load', init);

  return {
    init:init
  };

}(window, window.document));