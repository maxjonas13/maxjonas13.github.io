<?php snippet('head') ?>
<?php snippet('header') ?>

<main class="actionfigure">
    <h1 class="heading"><?= $page->headline()->or($page->title()) ?></h1>

    <div class="actionfigure-text text">
      <?= $page->description()->kt() ?>

      <?php if ($page->tags()->isNotEmpty()): ?>
      <p class="actionfigure-tags tags"><?= $page->tags() ?></p>
      <?php endif ?>
    </div>

    <div class="actionfigure-gallery" >

          <h2><?php echo $page->title();?></h2>
          <p><?php echo $page->text();?></p>
          <date><?php echo $page->releasedate();?></date>
          <p><?php echo $page->buyingsites();?></p>
          <p><?php echo $page->price();?></p>
          <?php foreach ($page->files() as $images):
              echo $images;
            endforeach;
          ?>
    </div>
</main>

<div id="viewforce">
  <a href='#' class="control" id="prev"><</a>
  <img src="" class="viewforceimage">
  <a href='#' class="control" id="next">></a>
</div>

<?php snippet('footer') ?>
<?php snippet('foot') ?>