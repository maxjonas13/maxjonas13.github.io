<?php snippet('header') ?>

<main>
  <header class="intro">
    <h1 class="heading"><?= $page->title() ?></h1>
  </header>
  <div class="text">
    <?= $page->text()->kt() ?>
  </div>
</main>

<?php snippet('footer') ?>
