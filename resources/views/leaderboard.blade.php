@extends('layout')
@section('title', 'Leaderboard – '.config('app.name'))
@section('content')
@php
    $link = fn (array $change) => route('leaderboard', array_filter(array_merge($filters, $change), fn ($v) => $v !== null && ! in_array($v, ['wins', 'all'], true)));
    $myName = auth()->user()?->name;
@endphp
<main class="lb-page">
    <h1>Leaderboard</h1>
    <p class="muted">Top 100 summoners. Win rate needs at least 3 games.</p>

    <nav class="lb-filters" aria-label="Leaderboard filters">
        <div class="grp"><span class="lbl">Rank by</span>
            @foreach ($sorts as $key => $label)
                <a href="{{ $link(['sort' => $key]) }}" class="chip {{ $filters['sort'] === $key ? 'on' : '' }}">{{ $label }}</a>
            @endforeach
        </div>
        <div class="grp"><span class="lbl">Champion</span>
            <a href="{{ $link(['champion' => null]) }}" class="chip {{ $filters['champion'] ? '' : 'on' }}">All</a>
            @foreach ($champions as $c)
                <a href="{{ $link(['champion' => $c]) }}" class="chip {{ $filters['champion'] === $c ? 'on' : '' }}">{{ ucfirst($c) }}</a>
            @endforeach
        </div>
        <div class="grp"><span class="lbl">Period</span>
            @foreach ($periods as $key => $label)
                <a href="{{ $link(['period' => $key]) }}" class="chip {{ $filters['period'] === $key ? 'on' : '' }}">{{ $label }}</a>
            @endforeach
        </div>
    </nav>

    <div class="board">
        <table class="lb-table">
            <thead><tr>
                <th>#</th><th>Summoner</th>
                <th class="num {{ $filters['sort'] === 'wins' ? 'sorted' : '' }}">Wins</th>
                <th class="num">Games</th>
                <th class="num {{ $filters['sort'] === 'winrate' ? 'sorted' : '' }}">Win %</th>
                <th class="num {{ $filters['sort'] === 'kills' ? 'sorted' : '' }}">Kills</th>
                <th class="num">Deaths</th>
                <th class="num {{ $filters['sort'] === 'kda' ? 'sorted' : '' }}">K/D</th>
                <th class="num">Best Lv</th>
            </tr></thead>
            <tbody>
            @forelse ($rows as $i => $row)
                <tr class="{{ $i < 3 ? 'top'.($i + 1) : '' }} {{ $myName && $row->player_name === $myName ? 'me' : '' }}">
                    <td class="rank">{{ $i + 1 }}</td>
                    <td>{{ $row->player_name }}</td>
                    <td class="num">{{ $row->wins }}</td>
                    <td class="num">{{ $row->games }}</td>
                    <td class="num">{{ (int) $row->winrate }}%</td>
                    <td class="num">{{ $row->kills }}</td>
                    <td class="num">{{ $row->deaths }}</td>
                    <td class="num">{{ number_format((float) $row->kda, 2) }}</td>
                    <td class="num">{{ $row->best_level }}</td>
                </tr>
            @empty
                <tr><td colspan="9" class="muted">No matches here yet. <a href="{{ route('home') }}#champions">Play one!</a></td></tr>
            @endforelse
            </tbody>
        </table>
    </div>
</main>
@endsection
