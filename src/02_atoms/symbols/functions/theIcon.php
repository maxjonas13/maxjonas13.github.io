<?php

function theIcon($name = false, $return = false) {

	if(!$name) { return ''; }

	$theIconMarkup = '<svg class="symbol symbol--' . $name . '"><use id="symbol--' . $name . '" xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="#symbol--' . $name . '"></use></svg>';

	if($return) {

		return $theIconMarkup;

	}

	echo $theIconMarkup;

}

?>