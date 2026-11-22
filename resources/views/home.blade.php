@extends('layout')

@section('content')
<main class="lobby">
    <header class="lobby-head">
        <h1>Nexus Quest <span>League</span></h1>
        <p>3v3 battle arena. Push the lanes, topple the towers, destroy the enemy Nexus.</p>
    </header>

    <form class="select" method="get" action="{{ route('play') }}">
        <label class="name-field">
            Summoner name
            <input name="name" maxlength="24" required value="{{ old('name', 'Summoner') }}">
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

        <button class="btn-play" type="submit">Find Match</button>
    </form>

    <section class="boards">
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
        <p><kbd>Right-click</kbd> move / attack · <kbd>Q</kbd><kbd>W</kbd><kbd>E</kbd><kbd>R</kbd> abilities (aim with mouse) · <kbd>D</kbd> Flash · <kbd>B</kbd> Recall · <kbd>P</kbd> Shop (in base) · <kbd>Y</kbd> toggle camera lock · <kbd>Space</kbd> re-center · <kbd>A</kbd> attack nearest · <kbd>S</kbd> stop · <kbd>Esc</kbd> pause</p>
    </section>
</main>
@endsection
