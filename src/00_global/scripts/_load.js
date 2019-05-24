; var load = (function(w, d, undefined) {

  "use strict";
  var is_not_loaded_yet = true;
  var init = function() {
    var classes = document.body.classList;
    for (var i = classes.length - 1; i >= 0; i--) {
      if(classes[i] == "loaded"){
          is_not_loaded_yet = false;
      };
    }
    if(is_not_loaded_yet){
      is_not_loaded_yet = false;
      setTimeout(function(){ document.body.classList += " loaded"; }, 300);
      setTimeout(function(){ document.body.classList += " fadout"; }, 450);
    }
  };

  d.addEventListener('DOMContentLoaded', init);

  return {
    init:init
  };

}(window, window.document));