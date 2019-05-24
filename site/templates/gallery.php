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

    <div class="album-gallery home">
            <?php foreach ($page->children()->sortBy('date', 'desc') as $album): ?>
                    <a href="<?php echo $album->url() ?>" class='albumItem'>
                        <div class="img" style='background-image: url(<?php echo $album->files()->shuffle()->first()->url()?>)'></div>
                        <span><?php echo $album->title()?></span>
                    </a>
            <?php endforeach ?>
</main>

<?php snippet('footer') ?>
<?php snippet('foot') ?>