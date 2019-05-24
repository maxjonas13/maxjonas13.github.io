<!doctype html>
<html lang="en">
<head>

	<title><?= $site->title() ?> | <?= $page->title() ?></title>

	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no">

	<?php if ($page->template() != "qr" && $page->template() != "error"): ?>
		<meta name="description" content="<?= $page->meta_description()?>">
		<meta name="keywords" content="<?= $page->meta_keywords()?>">
		<meta name="author" content="<?= $page->meta_author()?>">
		<meta name="msapplication-config" content="/assets/graphics/browserconfig.xml">
		<meta name="theme-color" content="#ffffff">

		<meta property="og:title" content="<?= $page->og_title() ?>">
		<meta property="og:site_name" content="<?= $site->title()?>">
		<meta property="og:description" content="<?= $page->og_description()?>">
		<meta property="og:type" content="website">

		<?php if($page->og_image()->isNotEmpty() && $page->og_image()->toFile()): ?>
			<meta property="og:image" content="<?= $page->og_image()->toFile()->resize(600,315)->url() ?>">
		<?php endif; ?>

		<meta property="og:url" content="<?= $site->url()?>">

		<meta property="twitter:card" content="summary">
		<meta property="twitter:title" content="<?= $page->og_title() ?>">
		<meta property="twitter:description" content="<?= $page->og_description()?>">

		<?php if($page->og_image()->isNotEmpty() && $page->og_image()->toFile()): ?>
			<meta property="twitter:image" content="<?= $page->og_image()->toFile()->resize(600,315)->url() ?>">
		<?php endif; ?>

		<meta property="twitter:url" content="<?= $site->url()?>">
	<?php endif; ?>

	<link rel="apple-touch-icon" sizes="180x180" href="/assets/graphics/apple-touch-icon.png">
	<link rel="icon" type="image/png" sizes="32x32" href="/assets/graphics/favicon-32x32.png">
	<link rel="icon" type="image/png" sizes="16x16" href="/assets/graphics/favicon-16x16.png">
	<link rel="manifest" href="/assets/graphics/manifest.json">
	<link rel="mask-icon" href="/assets/svg/safari-pinned-tab.svg" color="#e2231a">
	<link rel="shortcut icon" href="/assets/graphics/favicon.ico">

  <?= css(['assets/styles/main.css']) ?>


 	<link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Open+Sans:300,600">

	<!-- Hotjar Tracking Code for https://cheers.rodenbach.be -->
	<script>
	    (function(h,o,t,j,a,r){
	        h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};
	        h._hjSettings={hjid:1277622,hjsv:6};
	        a=o.getElementsByTagName('head')[0];
	        r=o.createElement('script');r.async=1;
	        r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;
	        a.appendChild(r);
	    })(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');
	</script>

	<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-MB8ZVW6');</script>
</head>
<body class="page--<?= $page->template() ?>">

	<noscript>
		<iframe src="https://www.googletagmanager.com/ns.html?id=GTM-MB8ZVW6" height="0" width="0" style="display:none;visibility:hidden"></iframe>
	</noscript>

  <div id="theBucket">