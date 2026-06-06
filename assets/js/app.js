/* Shared site script: reads data files and draws the pages. */

/* Copy a command to the clipboard, with a little confirmation. */
function copy(el, text) {
  navigator.clipboard.writeText(text).then(() => {
    el.classList.add('copied');
    setTimeout(() => el.classList.remove('copied'), 1200);
    const t = document.getElementById('toast');
    if (t) {
      t.classList.add('show');
      setTimeout(() => t.classList.remove('show'), 1500);
    }
  });
}

/* A command name can be a plain string, or an object with a display
   label and a different text to copy (for ones with placeholders). */
function normaliseName(n) {
  if (typeof n === 'string') return { label: n, copy: n };
  return { label: n.label, copy: (n.copy !== undefined ? n.copy : n.label) };
}

/* Build the commands page from the data. */
function renderCommands(data, root) {
  root.innerHTML = '';

  (data.sections || []).forEach((sec) => {
    const isGold = sec.style === 'gold';

    const section = document.createElement('div');
    section.className = 'section';

    const title = document.createElement('div');
    title.className = 'section-title' + (isGold ? ' gold' : '');
    title.append(sec.icon ? sec.icon + ' ' + sec.title : sec.title);
    if (sec.badge) {
      const b = document.createElement('span');
      b.className = 'badge badge-se';
      b.textContent = sec.badge;
      title.append(' ');
      title.appendChild(b);
    }
    section.appendChild(title);

    const cmds = document.createElement('div');
    cmds.className = 'commands';

    (sec.rows || []).forEach((row) => {
      const cmd = document.createElement('div');
      cmd.className = 'command' + (isGold ? ' special' : '');

      if (row.label) {
        const lab = document.createElement('span');
        lab.className = 'label';
        lab.textContent = row.label;
        cmd.appendChild(lab);
      }

      (row.names || []).forEach((rawName) => {
        const n = normaliseName(rawName);
        const span = document.createElement('span');
        span.className = 'cmd' + (isGold ? ' gold-cmd' : '');

        const txt = document.createTextNode(n.label + ' ');
        span.appendChild(txt);

        const icon = document.createElement('span');
        icon.className = 'icon';
        icon.textContent = '⧉';
        span.appendChild(icon);

        span.addEventListener('click', () => copy(span, n.copy));
        cmd.appendChild(span);
      });

      if (row.desc) {
        const d = document.createElement('span');
        d.className = 'inline-desc' + (isGold ? ' gold' : '');
        d.textContent = row.desc;
        cmd.appendChild(d);
      }

      cmds.appendChild(cmd);
    });

    section.appendChild(cmds);
    root.appendChild(section);
  });
}

/* ---- Home page renderers ---- */
function renderAbout(data) {
  const tagline = document.getElementById('tagline');
  if (tagline && data.tagline) tagline.textContent = data.tagline;

  const root = document.getElementById('about-root');
  if (!root) return;
  root.innerHTML = '';
  const card = document.createElement('div');
  card.className = 'about-card';
  (data.paragraphs || []).forEach((p) => {
    const para = document.createElement('p');
    para.textContent = p;
    card.appendChild(para);
  });
  if ((data.pills || []).length) {
    const pills = document.createElement('div');
    pills.className = 'pills';
    data.pills.forEach((p) => {
      const span = document.createElement('span');
      span.className = 'pill';
      span.textContent = p;
      pills.appendChild(span);
    });
    card.appendChild(pills);
  }
  root.appendChild(card);
}

function renderSchedule(data) {
  const root = document.getElementById('schedule-root');
  if (!root) return;
  root.innerHTML = '';
  const list = document.createElement('div');
  list.className = 'schedule';
  (data.days || []).forEach((d) => {
    const row = document.createElement('div');
    row.className = 'day';
    const name = document.createElement('span'); name.className = 'name'; name.textContent = d.name;
    const time = document.createElement('span'); time.className = 'time'; time.textContent = d.time;
    const game = document.createElement('span'); game.className = 'game'; game.textContent = d.game;
    row.append(name, time, game);
    list.appendChild(row);
  });
  root.appendChild(list);
  if (data.note) {
    const note = document.createElement('p');
    note.className = 'schedule-note';
    note.textContent = data.note;
    root.appendChild(note);
  }
}

function renderSocials(data) {
  const root = document.getElementById('socials-root');
  if (!root) return;
  root.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'socials';
  (data.items || []).forEach((it) => {
    const a = document.createElement('a');
    a.className = 'social' + (it.wide ? ' wide' : '') + (it.primary ? ' primary' : '');
    a.href = it.url;
    if (/^https?:/i.test(it.url)) a.target = '_blank';
    const ico = document.createElement('span'); ico.className = 'ico'; ico.textContent = it.icon;
    const txt = document.createElement('span'); txt.className = 'txt';
    const label = document.createElement('span'); label.className = 'label'; label.textContent = it.label;
    const sub = document.createElement('span'); sub.className = 'sub'; sub.textContent = it.sub;
    txt.append(label, sub);
    a.append(ico, txt);
    grid.appendChild(a);
  });
  root.appendChild(grid);
}

/* ---- Charity page renderers ---- */
function renderCharity(data) {
  const aboutRoot = document.getElementById('charity-about-root');
  if (aboutRoot) {
    aboutRoot.innerHTML = '';
    const card = document.createElement('div');
    card.className = 'about-card';
    (data.whatWeDo || []).forEach((p) => {
      const para = document.createElement('p');
      para.textContent = p;
      card.appendChild(para);
    });
    aboutRoot.appendChild(card);
  }

  const causeRoot = document.getElementById('cause-root');
  if (causeRoot && data.cause) {
    causeRoot.innerHTML = '';
    const box = document.createElement('div');
    box.className = 'cause';
    const badge = document.createElement('span'); badge.className = 'cause-badge'; badge.textContent = 'Now raising';
    const h2 = document.createElement('h2'); h2.textContent = data.cause.name;
    const p = document.createElement('p'); p.textContent = data.cause.desc;
    const btn = document.createElement('a');
    btn.className = 'donate-btn';
    btn.href = data.cause.link;
    btn.target = '_blank';
    btn.textContent = 'Donate 💜';
    box.append(badge, h2, p, btn);
    causeRoot.appendChild(box);
  }

  const stepsRoot = document.getElementById('steps-root');
  if (stepsRoot) {
    stepsRoot.innerHTML = '';
    const list = document.createElement('div');
    list.className = 'steps';
    (data.steps || []).forEach((s, i) => {
      const step = document.createElement('div');
      step.className = 'step';
      const num = document.createElement('span'); num.className = 'num'; num.textContent = (i + 1);
      const txt = document.createElement('span'); txt.className = 'txt'; txt.textContent = s;
      step.append(num, txt);
      list.appendChild(step);
    });
    stepsRoot.appendChild(list);
  }
}

/* ---- Generic loader ---- */
async function loadInto(path, renderFn, rootId) {
  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error('load failed');
    const data = await res.json();
    renderFn(data);
  } catch (err) {
    const root = document.getElementById(rootId);
    if (root) root.innerHTML = '<div class="state-msg">This could not load right now. Please try again in a moment.</div>';
  }
}

/* On load, fill whichever page we are on. */
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('commands-root')) {
    document.getElementById('commands-root').innerHTML = '<div class="state-msg">Loading commands...</div>';
    loadInto('data/commands.json', (d) => renderCommands(d, document.getElementById('commands-root')), 'commands-root');
  }
  if (document.getElementById('about-root')) {
    loadInto('data/about.json', renderAbout, 'about-root');
    loadInto('data/schedule.json', renderSchedule, 'schedule-root');
    loadInto('data/socials.json', renderSocials, 'socials-root');
  }
  if (document.getElementById('charity-about-root')) {
    loadInto('data/charity.json', renderCharity, 'charity-about-root');
  }
});
