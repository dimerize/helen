(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const A = name => `/artwork/${name}`;
  const projects = {
    thesis: {
      title: 'Beyond the Humanized Machine', titleHTML: 'Beyond the<br>Humanized Machine', type: 'Fine art installation',
      summary: 'A scan becomes a painting. A painting becomes someone else’s image. An installation about what changes each time we translate what we see.',
      heading: 'The image keeps changing.',
      context: 'A handheld scan holds the movement of a hand as much as the image it records. Painting translates that imperfect record into a surface. Viewers then draw what they see within it, introducing another reading. Each transfer produces something that the previous image could not contain.',
      details: [['Role', 'Artist'], ['Materials', 'Acrylic, homasote, burlap, projection'], ['Process', 'Handheld scanning, painting, viewer interpretation, TouchDesigner']],
      process: '<p>The work follows repeated translations: a source image passes through a handheld scanner, into paint, and into a viewer’s drawing. Distortion, gaps, and misreadings become part of the image.</p><p>The thesis paper combines completed work with proposed installation components. “Gaps in Netted Mesh” is a painting photograph. “Bent Mesh,” “Elongated,” and the room view shown here are mockups. The interpretation images are viewers’ drawings over the painting. The comparison makes their different readings visible.</p>',
      views: ['Source', 'Painting', 'Interpretations', 'Installation'], defaultView: 'Painting', next: ['Standing Room Only', 'standing']
    },
    '8ppi': {
      title: '8PPI', type: 'Painting, collage & moving image',
      summary: 'A low-resolution locket photograph passes through sixteen small paintings and back into video, carrying a different kind of memory with each translation.',
      heading: 'A small image, translated again.',
      context: 'A personal locket photograph becomes a physical stop-motion sequence made with paint and paper collage on sixteen small canvas panels. Digital converters degrade the sequence further before it is edited into a moving image.',
      details: [['Role', 'Artist'], ['Materials', 'Paint, paper collage, sixteen canvas panels, video'], ['Process', 'Physical stop-motion, digital conversion, Premiere']],
      process: '<p>The source is a low-resolution personal locket photograph. Working through paint and paper collage gives its limited information a new material form; conversion and editing then change the image again.</p><p>The panels and installation are documented below. Film documentation is forthcoming.</p>',
      views: ['Installation', 'Panels', 'Film'], defaultView: 'Installation', next: ['Jack.exe & Rose-liet', 'jack']
    },
    standing: {
      title: 'Standing Room Only', titleHTML: 'Standing<br>Room Only', type: 'Video & interactive installation',
      summary: 'Daily observations from NJ Transit become a room of projected images, ambient sound, and the movement of a viewer’s body.',
      heading: 'The commute moves into the room.',
      context: 'Train footage, ambient recordings, and handheld scans collect the details of a daily commute. In the installation, TouchDesigner body tracking connects a viewer’s movement with the projection. The project later developed into a three-channel iteration.',
      details: [['Role', 'Artist'], ['Materials', 'Original train footage, ambient recordings, handheld scans, projection'], ['Process', 'TouchDesigner body tracking']],
      process: '<p>The train scans record worn signage, instructions, and surfaces observed during a daily NJ Transit commute. They are process material alongside the artist’s own footage and field recordings.</p><p>The installation photograph here documents an earlier version. Documentation of the later three-channel iteration is forthcoming.</p>',
      views: ['Installation', 'Train scans', 'Film'], defaultView: 'Installation', next: ['8PPI', '8ppi']
    },
    jack: {
      title: 'Jack.exe & Rose-liet', titleHTML: 'Jack.exe<br>& Rose-liet', type: 'Script, moving image & installation proposal',
      summary: 'Titanic scenes are rewritten through language-model prompts, then selected, cut, voiced, and edited into another version of the film.',
      heading: 'A familiar script becomes unstable.',
      context: 'Prompts to a local language model produce rewritten scenes from Titanic. The work takes shape through the artist’s selection and redaction of the results, followed by AI-generated voices and film editing.',
      details: [['Role', 'Artist, prompting, selection & editing'], ['Materials', 'Rewritten and redacted scripts, AI-generated voice, film edits'], ['Tools', 'llama.cpp / llamafile, Premiere']],
      process: '<p>The process uses a local language model through llama.cpp / llamafile. The artist prompts and curates the resulting text, revises scenes, and works with AI-generated voice and film editing.</p><p>The revised screenplay is shown here. Film and installation documentation is forthcoming.</p>',
      views: ['Revised script', 'Film'], defaultView: 'Revised script', next: ['Side Effects May Include', 'side-effects']
    },
    'side-effects': {
      title: 'Side Effects May Include', type: 'Moving image',
      summary: 'A film assembled from the repeated language of more than fifty archival US prescription advertisements from 2012–2018.',
      heading: 'Repetition becomes the material.',
      context: 'VideoGrep creates supercuts from an archive of prescription advertisements. The artist then selects and edits those fragments in Premiere, working with the patterns produced by recurring phrases.',
      details: [['Role', 'Artist, archive selection & editing'], ['Source', '50+ archival US prescription advertisements, 2012–2018'], ['Tools', 'VideoGrep command line, Premiere']],
      process: '<p>VideoGrep is used to locate and assemble repeated language from the collected advertisements. Curating and editing the resulting supercuts is a separate part of the work.</p><p>Film documentation is forthcoming.</p>',
      views: ['Film'], defaultView: 'Film', next: ['Beyond the Humanized Machine', 'thesis']
    }
  };
  const requested = new URLSearchParams(location.search).get('work') || 'thesis';
  const key = Object.hasOwn(projects, requested) ? requested : 'thesis';
  const project = projects[key];
  const state = {view: project.defaultView, painting: 0, drawing: 0, compare: true, scan: 0};
  const paintings = [
    {file: 'thesis-painting.webp', title: 'Gaps in Netted Mesh', note: 'Painting photograph. Acrylic on homasote.'},
    {file: 'thesis-dark-grid.webp', title: 'Bent Mesh', note: 'Painting mockup from the thesis materials.'},
    {file: 'thesis-elongated.webp', title: 'Elongated', note: 'Painting mockup from the thesis materials.'}
  ];
  const scans = [
    {file: 'train-scan.webp', title: 'Exit / caution', note: 'Handheld scan of train signage; process material.'},
    {file: 'train-scan-wide.webp', title: 'Watch your step', note: 'Handheld scan of worn warning lettering; process material.'},
    {file: 'train-scan-notice.webp', title: 'Surveillance notice', note: 'Handheld scan of a train notice; process material.'}
  ];
  let currentCaption = '';
  let returnFocus = null;

  document.title = `${project.title} — Helen Zhang`;
  $('project-title').innerHTML = project.titleHTML || project.title;
  $('project-type').textContent = project.type;
  $('project-summary').textContent = project.summary;
  $('context-title').textContent = project.heading;
  $('context-copy').textContent = project.context;
  $('project-details').innerHTML = project.details.map(([term, value]) => `<dt>${term}</dt><dd>${value}</dd>`).join('');
  $('process-copy').innerHTML = project.process;
  $('next-project').href = project.next[1] === 'thesis' ? '/project' : `/project?work=${project.next[1]}`;
  $('next-project').firstElementChild.textContent = project.next[0];
  $('view-tabs').innerHTML = project.views.map((view, i) => `<button type="button" role="tab" id="view-${i}" aria-controls="media-panel" aria-selected="${view === state.view}" tabindex="${view === state.view ? 0 : -1}" data-view="${view}">${view}</button>`).join('');

  function imageMarkup(file, alt) { return `<img src="${A(file)}" alt="${alt}" decoding="async">`; }
  function chooseGroup(label, choices, selected, name) {
    return `<div class="choice-group" role="group" aria-label="${label}"><span class="choice-label">${label}</span>${choices.map((choice, i) => `<button class="choice-button" type="button" data-choice="${name}" data-index="${i}" aria-pressed="${i === selected}">${choice}</button>`).join('')}</div>`;
  }
  function render() {
    const content = $('art-content');
    const controls = $('sub-controls');
    const tabs = [...$('view-tabs').children];
    tabs.forEach(tab => { const active = tab.dataset.view === state.view; tab.setAttribute('aria-selected', active); tab.tabIndex = active ? 0 : -1; });
    $('media-panel').setAttribute('aria-labelledby', tabs.find(tab => tab.dataset.view === state.view).id);
    controls.innerHTML = '';
    content.className = 'art-content';
    $('enlarge').hidden = false;
    let title, note, file;
    if (key === 'thesis') {
      if (state.view === 'Source') {
        file = 'thesis-source.webp'; title = 'Three fragments of an advertisement';
        note = 'Partial handheld scans assembled together. The partial capture is the starting point for the work.';
      } else if (state.view === 'Painting') {
        controls.innerHTML = chooseGroup('Work', paintings.map(item => item.title), state.painting, 'painting');
        ({file, title, note} = paintings[state.painting]);
      } else if (state.view === 'Interpretations') {
        controls.innerHTML = chooseGroup('Viewer drawing', ['1', '2', '3', '4'], state.drawing, 'drawing') + `<label class="compare-control"><input id="compare-toggle" type="checkbox" ${state.compare ? 'checked' : ''}>Compare with painting</label>`;
        file = `interpretation-${state.drawing + 1}.webp`;
        title = `Viewer interpretation ${state.drawing + 1}`;
        note = 'Viewer drawing over the painting. Compare how the image changes through another person’s interpretation.';
        if (state.compare) {
          content.classList.add('double');
          content.innerHTML = `<div class="art-pair">${imageMarkup('thesis-painting.webp', 'Gaps in Netted Mesh, painting photograph')}<span>Painting</span></div><div class="art-pair">${imageMarkup(file, title)}<span>${title}</span></div>`;
        }
      } else {
        file = 'thesis-installation.webp'; title = 'Installation mockup';
        note = 'Proposed arrangement of paintings and projected interpretations, from the thesis materials.';
        content.classList.add('landscape');
        controls.innerHTML = '<a class="gallery-project-link" href="/gallery">Step inside the installation <span aria-hidden="true">↗</span></a>';
      }
    } else if (key === '8ppi' && state.view !== 'Film') {
      file = state.view === 'Installation' ? '8ppi-installation.webp' : '8ppi-panels.webp';
      title = state.view === 'Installation' ? '8PPI, installation view' : 'Sixteen painted panels';
      note = state.view === 'Installation' ? 'Installation photograph, with painted panels and a screen below.' : 'Paint and paper collage on small canvas panels, photographed on their support.';
    } else if (key === 'standing' && state.view !== 'Film') {
      if (state.view === 'Train scans') {
        controls.innerHTML = chooseGroup('Scan', scans.map(item => item.title), state.scan, 'scan');
        ({file, title, note} = scans[state.scan]);
      } else {
        file = 'train-installation.webp'; title = 'Standing Room Only, earlier installation';
        note = 'Documentation of an earlier version. The project later developed into a three-channel iteration.';
        content.classList.add('landscape');
      }
    } else if (key === 'jack' && state.view === 'Revised script') {
      file = 'script-revised.webp'; title = 'A revised Titanic scene';
      note = 'A screenplay page with redacted source text and rewritten lines.';
    } else {
      title = 'Film documentation forthcoming'; note = 'Film documentation will be added here.';
      content.classList.add('no-image');
      content.innerHTML = '<div class="missing-media"><p>Film documentation<br>forthcoming</p><span>The original moving image will be added here.</span></div>';
      $('enlarge').hidden = true;
    }
    if (file && !(key === 'thesis' && state.view === 'Interpretations' && state.compare)) content.innerHTML = imageMarkup(file, title);
    currentCaption = `${title}. ${note}`;
    $('figure-caption').innerHTML = `<p><strong>${title}</strong></p><p>${note}</p>`;
    // A failed source remains legible and never resembles a missing-image icon.
    content.querySelectorAll('img').forEach(img => img.addEventListener('error', () => {
      const message = document.createElement('span'); message.className = 'missing-media'; message.textContent = `${img.alt} — image unavailable. Please try again.`; img.replaceWith(message);
      if (!content.querySelector('img')) $('enlarge').hidden = true;
    }, {once: true}));
  }

  $('view-tabs').addEventListener('click', event => {
    const tab = event.target.closest('[data-view]'); if (!tab) return;
    state.view = tab.dataset.view; render();
  });
  $('view-tabs').addEventListener('keydown', event => {
    const tabs = [...$('view-tabs').children];
    const index = tabs.indexOf(document.activeElement);
    if (index < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const target = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    state.view = tabs[target].dataset.view; render(); tabs[target].focus();
  });
  $('sub-controls').addEventListener('click', event => {
    const button = event.target.closest('[data-choice]'); if (!button) return;
    const choice = button.dataset.choice, index = Number(button.dataset.index);
    state[choice] = index; render();
    $('sub-controls').querySelector(`[data-choice="${choice}"][data-index="${index}"]`).focus({preventScroll: true});
  });
  $('sub-controls').addEventListener('change', event => {
    if (event.target.id !== 'compare-toggle') return;
    state.compare = event.target.checked; render(); $('compare-toggle').focus({preventScroll: true});
  });
  $('reset-view').addEventListener('click', () => {
    Object.assign(state, {view: project.defaultView, painting: 0, drawing: 0, compare: true, scan: 0}); render();
  });
  function openDetail() {
    if ($('enlarge').hidden) return;
    returnFocus = document.activeElement;
    $('dialog-content').innerHTML = $('art-content').innerHTML;
    $('dialog-caption').textContent = currentCaption;
    $('image-dialog').showModal();
    document.body.style.overflow = 'hidden';
    $('close-dialog').focus();
  }
  $('enlarge').addEventListener('click', openDetail);
  $('art-content').addEventListener('click', event => { if (event.target.tagName === 'IMG') openDetail(); });
  $('close-dialog').addEventListener('click', () => $('image-dialog').close());
  $('image-dialog').addEventListener('click', event => {
    if (event.target !== $('image-dialog')) return;
    const rect = $('image-dialog').getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) $('image-dialog').close();
  });
  $('image-dialog').addEventListener('close', () => {
    document.body.style.overflow = '';
    if (returnFocus && returnFocus !== document.body) returnFocus.focus({preventScroll: true});
    else $('enlarge').focus({preventScroll: true});
  });
  render();
})();
