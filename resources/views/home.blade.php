@extends('layout')

@section('content')
<section class="hero" style="--hero:url('{{ asset('img/hero.jpg') }}')">
    <div class="wrap hero-in">
        <p class="eyebrow">Free · Browser · Desktop &amp; Mobile</p>
        <h1>Lead your team to <span>victory</span> in 15 minutes.</h1>
        <p class="lead">Nexus Quest League is a fast 3v3 battle arena that runs right in your browser. Pick a champion, push your lane, topple the towers and shatter the enemy Nexus. No download, no install, no pay-to-win.</p>
        <div class="hero-cta">
            <a href="#champions" class="btn-play">Play Free Now ▸</a>
            @guest<a href="{{ route('register') }}" class="btn ghost lg">Create free account</a>@endguest
        </div>
        <ul class="proof">
            @if ($stats['matches'] >= 50)
                <li><b>{{ number_format($stats['matches']) }}</b> matches played</li>
                <li><b>{{ number_format($stats['players']) }}</b> summoners</li>
                <li><b>{{ number_format($stats['kills']) }}</b> champions slain</li>
            @else
                <li><b>3v3</b> team battles</li>
                <li><b>~15 min</b> per match</li>
                <li><b>0</b> downloads needed</li>
            @endif
        </ul>
    </div>
</section>

<main class="lobby">
    <section id="features" class="features">
        <h2 class="sec-title">Why players love it</h2>
        <div class="feat-grid">
            <div class="feat"><i>⚡</i><h3>Instant matches</h3><p>One click and you're in the arena. No queue, no lobby wait, no 40-minute commitment.</p></div>
            <div class="feat"><i>📱</i><h3>Play anywhere</h3><p>Full keyboard &amp; mouse on desktop, a virtual joystick and tap-to-aim on phones and tablets.</p></div>
            <div class="feat"><i>🧠</i><h3>Smart AI teammates</h3><p>Allies and enemies farm, trade, buy items, retreat and gank, so every match feels alive.</p></div>
            <div class="feat"><i>🏆</i><h3>Climb the ladder</h3><p>Every match is recorded. Sign in to keep your name and race to the top of the leaderboard.</p></div>
            <div class="feat"><i>🛡️</i><h3>Real strategy</h3><p>Three lanes, towers, minion waves, items, levels and ultimates, all in a bite-sized match.</p></div>
            <div class="feat"><i>💸</i><h3>Free, fair, forever</h3><p>No loot boxes and no paid power. Skill is the only thing you can buy here.</p></div>
        </div>
    </section>

    <section id="champions" class="pick">
        <h2 class="sec-title">Choose your champion</h2>
    <form class="select" method="get" action="{{ route('play') }}">
        <label class="name-field">
            Summoner name
            <input name="name" maxlength="24" required value="{{ old('name', auth()->user()?->name ? \Illuminate\Support\Str::limit(auth()->user()->name, 24, '') : 'Summoner') }}">
        </label>

        <div class="champs">
            <label class="champ-card">
                <input type="radio" name="champion" value="vanguard" checked>
                <div class="champ-body" style="--c:#4f8cff">
                    <div class="champ-icon">V</div>
                    <h3>Vanguard</h3>
                    <p class="role">Fighter · Melee</p>
                    <ul>
                        <li><b>Q</b> Valiant Strike – dash and slam</li>
                        <li><b>W</b> Bulwark – shield</li>
                        <li><b>E</b> Whirlwind – spin damage</li>
                        <li><b>R</b> Verdict – execute a champion</li>
                    </ul>
                </div>
            </label>
            <label class="champ-card">
                <input type="radio" name="champion" value="arcanist">
                <div class="champ-body" style="--c:#b26bff">
                    <div class="champ-icon">A</div>
                    <h3>Arcanist</h3>
                    <p class="role">Mage · Ranged</p>
                    <ul>
                        <li><b>Q</b> Arcane Bolt – skillshot</li>
                        <li><b>W</b> Rift – delayed stun zone</li>
                        <li><b>E</b> Blink – teleport</li>
                        <li><b>R</b> Cataclysm – long beam</li>
                    </ul>
                </div>
            </label>
            <label class="champ-card">
                <input type="radio" name="champion" value="ranger">
                <div class="champ-body" style="--c:#3fd18b">
                    <div class="champ-icon">R</div>
                    <h3>Ranger</h3>
                    <p class="role">Marksman · Ranged</p>
                    <ul>
                        <li><b>Q</b> Rapid Fire – attack speed</li>
                        <li><b>W</b> Volley – arrow cone</li>
                        <li><b>E</b> Tumble – quick dash</li>
                        <li><b>R</b> Sky Arrow – global stun arrow</li>
                    </ul>
                </div>
            </label>
        </div>

        <button class="btn-play" type="submit">Play Free Now ▸</button>
        <p class="small muted">No download. Matches start instantly against AI champions.</p>
    </form>
    </section>

    <section class="cta-band">
        <div>
            <h2>Sign in to save your glory</h2>
            <p>Use your Google or nikniq.com account. It takes five seconds, and your wins follow you everywhere.</p>
        </div>
        @guest
            <div class="cta-actions">
                <a href="{{ route('register') }}" class="btn lg">Create free account</a>
                <a href="{{ route('login') }}" class="btn ghost lg">Log in</a>
            </div>
        @else
            <a href="#champions" class="btn lg">Play now</a>
        @endguest
    </section>

    <section class="boards" id="leaderboard">
        <div class="board">
            <h2>Leaderboard</h2>
            <table>
                <thead><tr><th>#</th><th>Summoner</th><th>W</th><th>G</th><th>K/D</th></tr></thead>
                <tbody>
                @forelse ($leaders as $i => $row)
                    <tr>
                        <td>{{ $i + 1 }}</td>
                        <td>{{ $row->player_name }}</td>
                        <td>{{ $row->wins }}</td>
                        <td>{{ $row->games }}</td>
                        <td>{{ $row->kills }}/{{ $row->deaths }}</td>
                    </tr>
                @empty
                    <tr><td colspan="5" class="muted">No matches yet. Be the first!</td></tr>
                @endforelse
                </tbody>
            </table>
        </div>
        <div class="board">
            <h2>Recent Matches</h2>
            <table>
                <thead><tr><th>Summoner</th><th>Champion</th><th>Result</th><th>KDA</th><th>CS</th></tr></thead>
                <tbody>
                @forelse ($recent as $m)
                    <tr>
                        <td>{{ $m->player_name }}</td>
                        <td>{{ ucfirst($m->champion) }}</td>
                        <td class="{{ $m->victory ? 'win' : 'loss' }}">{{ $m->victory ? 'Victory' : 'Defeat' }}</td>
                        <td>{{ $m->kills }}/{{ $m->deaths }}</td>
                        <td>{{ $m->creep_score }}</td>
                    </tr>
                @empty
                    <tr><td colspan="5" class="muted">—</td></tr>
                @endforelse
                </tbody>
            </table>
        </div>
    </section>

    <section class="howto">
        <h2>Controls</h2>
        <p><kbd>Right-click</kbd> move / attack · <kbd>Q</kbd><kbd>W</kbd><kbd>E</kbd><kbd>R</kbd> abilities (aim with mouse) · <kbd>D</kbd> Flash · <kbd>1</kbd> Potion · <kbd>B</kbd> Recall · <kbd>P</kbd> Shop (in base) · <kbd>Y</kbd> toggle camera lock · <kbd>Space</kbd> re-center · <kbd>A</kbd> attack nearest · <kbd>S</kbd> stop · <kbd>Esc</kbd> pause</p>
        <p><b>On mobile/tablet</b> (landscape): left joystick to move · hold ⚔ to auto-attack · tap an ability to auto-aim, or drag from it to aim · tap the map to walk there.</p>
    </section>

    <section id="faq" class="faq">
        <h2 class="sec-title">FAQ</h2>
        <details><summary>Is it really free?</summary><p>Yes. Every champion and every item is available to everyone, and there is nothing to buy.</p></details>
        <details><summary>Do I need to download anything?</summary><p>No. It runs in any modern browser on desktop, laptop, tablet or phone.</p></details>
        <details><summary>Do I need an account?</summary><p>No, you can play as a guest. An account (email, Google or nikniq.com) keeps your name for the leaderboard.</p></details>
        <details><summary>How long is a match?</summary><p>Usually 10–18 minutes. Short enough for a break, deep enough to feel the comeback.</p></details>
    </section>
</main>
@endsection
