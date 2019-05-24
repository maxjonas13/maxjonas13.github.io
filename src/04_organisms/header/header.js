; var header = (function(w, d, undefined) {

  "use strict";

  var init = function() {
    scrollit()
    window.addEventListener("scroll", function() {
      var stheader = window.pageYOffset || document.body.scrollTop || document.documentElement.scrollTop,
      header = document.querySelectorAll( '.header:not(.shrink)' );
      if (stheader >= 1) {
        if (header[0] != undefined) {
          header[0].className += ' shrink';
        }
      } else {
        header = document.querySelectorAll( '.header' );
        if (header[0] != undefined) {
          header[0].className = 'header';
        }
      }
    }, false);

  },
  scrollit = function() {
    var stheader = window.pageYOffset || document.body.scrollTop || document.documentElement.scrollTop,
    header = document.querySelectorAll( '.header:not(.shrink)' );
    if (stheader >= 2) {
      if (header[0] != undefined) {
        header[0].className += ' shrink';
      }
    } else {
      header = document.querySelectorAll( '.header' );
      if (header[0] != undefined) {
        header[0].className = 'header';
      }
    }
  };

  d.addEventListener('load', init);

  return {
    init:init
  };

}(window, window.document));