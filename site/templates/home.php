<?php snippet('head') ?>
<?php snippet('header') ?>

<main>
    <h1 class="heading"><?php echo $page->recentGallerys() ?></h1>
    <div class="album-gallery home">
    <?php foreach ($page->siblings() as $sibling): ?>
        <?php if ($sibling->title() == "gallery") { ?>
            <?php foreach ($sibling->children()->sortBy('date', 'desc')->limit(8) as $album): ?>
                    <a href="<?php echo $album->url() ?>" class='albumItem'>
                        <div class="img" style='background-image: url(<?php echo $album->files()->shuffle()->first()->url()?>)'></div>
                        <span><?php echo $album->title()?></span>
                    </a>
            <?php endforeach ?>
        <?php } ?>
    <?php endforeach ?>
    </div>


</main>

<?php snippet('footer') ?>
<?php snippet('foot') ?>