<?php snippet('head') ?>
<?php snippet('header') ?>

<main class="whatIwant">
    <h1 class="heading"><?= $page->headline()->or($page->title()) ?></h1>

    <div class="whatIwant-text text">
      <?= $page->description()->kt() ?>

      <?php if ($page->tags()->isNotEmpty()): ?>
      <p class="whatIwant-tags tags"><?= $page->tags() ?></p>
      <?php endif ?>
    </div>

    <div class="whatIwant-gallery" >
      <?php foreach ($page->children() as $figure): ?>
        <a href="<?php echo $figure ?>">
          <img src="<?php echo $figure->files()->limit(1)  ?>" alt="<?php echo $figure->title();?>">
          <h3><?php echo $figure->title();?></h3>
        </a>
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