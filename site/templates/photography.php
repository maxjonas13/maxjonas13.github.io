<?php snippet('header') ?>

<main>
  <header class="intro">
    <h1 class="heading"><?= $page->title() ?></h1>
  </header>

  <div class="albums"<?= attr(['data-even' => $page->children()->listed()->isEven()], ' ') ?>>
    <?php foreach ($page->children()->listed() as $album): ?>
    <div class='albumItem'>
      <a href="<?= $album->url() ?>">
        <figure>
          <?php if ($cover = $album->cover()): ?>
          <?= $cover->crop(800, 1000) ?>
          <?php endif ?>
          <figcaption><?= $album->title() ?></figcaption>
        </figure>
      </a>
    </div>
    <?php endforeach ?>
  </ul>
</main>

<?php snippet('footer') ?>
