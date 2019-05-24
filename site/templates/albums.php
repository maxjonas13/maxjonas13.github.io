<?php snippet('head') ?>
<?php snippet('header') ?>

<main class="album">
    <h1 class="heading"><?= $page->headline()->or($page->title()) ?></h1>

    <div class="album-text text">
      <?= $page->description()->kt() ?>

      <?php if ($page->tags()->isNotEmpty()): ?>
      <p class="album-tags tags"><?= $page->tags() ?></p>
      <?php endif ?>
    </div>

    <div class="album-gallery" >
      <?php foreach ($page->files() as $image): ?>
        <?php
          if ($image->height() != 0) {
            $size = ($image->width() /  $image->height()) * 100;
          } else {
            $size = 0;
          }
        ?>
      <div class='albumItem' data-next="<?php echo ($image->hasNext()) ? $image->next()->url() : $image->first()->url() ?>" data-prev="<?php echo ($image->hasPrev()) ? $image->prev()->url() : $image->last()->url() ?>" style="padding-top: <?php echo $size . '%'?>; width: 100%; display: block;">
        <img data-src="<?php echo $image->url() ?>" class="lazy" style="width: 100%;" >
      </div>
      <?php endforeach ?>
    </div>
</main>

<div id="viewforce">
  <a href='#' class="control" id="prev"><</a>
  <img src="" class="viewforceimage">
  <a href='#' class="control" id="next">></a>
</div>

<?php snippet('footer') ?>
<?php snippet('foot') ?>