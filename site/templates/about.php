<?php snippet('head') ?>
<?php snippet('header') ?>

<main>
  <header class="intro">
    <h1 class="heading"><?= $page->title() ?></h1>
  </header>

  <div class="layout">

    <div class="timeline">

      <?php foreach ($page->children() as $content): ?>

        <section class="timeline_part">
          <div class="timeline_part__inner">
            <h1 class="heading"><?php echo $content->title()?></h1>
            <time datetime="<?php echo $content->date()?>"><?php echo $content->date()->toDate('d M Y') ?></time>
            <p class="desc"><?php echo $content->text()?></p>
            <img class="timelinimage" src="<?php echo $content->files() ?>" alt="">
          </div>
        </section>


      <?php endforeach;?>

    </div>
  </div>
</main>

<?php snippet('footer') ?>
<?php snippet('foot') ?>
