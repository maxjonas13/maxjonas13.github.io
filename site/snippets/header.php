
    <header class="header">
      <a class="logo" href="<?= $site->url() ?>"><?= $site->title() ?></a>

      <nav id="menu" class="menu">
        <?php foreach ($site->children()->listed() as $item): ?>
            <a data-slug="<?= $item->slug() ?>" href="/<?= $item->slug() ?>" class='nav-link'><?= $item->title() ?></a>
        <?php endforeach ?>
      </nav>

      <div class="pageposition" id="pageposition"></div>
    </header>

