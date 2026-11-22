@extends('layout')

@section('title', 'In Game – '.config('app.name'))
@section('body-class', 'ingame')

@section('content')
<canvas id="game"></canvas>

<div id="hud">
    <div class="top-bar">
        <span class="team blue" id="score-blue">0</span>
        <span id="clock">00:00</span>
        <span class="team red" id="score-red">0</span>
    </div>
    <div id="feed"></div>

    <div class="bottom">
        <div class="stats">
            <div><span>AD</span><b id="st-ad"></b></div>
            <div><span>AP</span><b id="st-ap"></b></div>
            <div><span>AR</span><b id="st-ar"></b></div>
            <div><span>AS</span><b id="st-as"></b></div>
            <div><span>MS</span><b id="st-ms"></b></div>
        </div>
        <div class="core">
            <div class="portrait" id="portrait"><span id="lvl">1</span></div>
            <div class="abil-wrap">
                <div class="abilities" id="abilities"></div>
                <div class="bar hp"><i id="hp-fill"></i><em id="hp-text"></em></div>
                <div class="bar mp"><i id="mp-fill"></i><em id="mp-text"></em></div>
                <div class="bar xp"><i id="xp-fill"></i></div>
            </div>
        </div>
        <div class="side">
            <div>KDA <b id="kda">0/0</b></div>
            <div>CS <b id="cs">0</b></div>
            <div class="gold">Gold <b id="gold">0</b></div>
            <div class="items" id="items"></div>
        </div>
    </div>

    <div id="shop" class="panel hidden">
        <h2>Shop <small>(only usable in base · P to close)</small></h2>
        <div id="shop-items"></div>
    </div>

    <div id="banner" class="hidden"></div>
    <div id="overlay" class="hidden">
        <div class="panel">
            <h1 id="ov-title"></h1>
            <p id="ov-text"></p>
            <div class="ov-actions">
                <a class="btn-play" href="{{ route('play', ['name' => $name, 'champion' => $champion]) }}">Play again</a>
                <a class="btn-play alt" href="{{ route('home') }}">Lobby</a>
            </div>
        </div>
    </div>
</div>
@endsection

@push('scripts')
<script>
    window.NQ = {
        name: @json($name),
        champion: @json($champion),
        saveUrl: @json(route('matches.store')),
    };
</script>
<script src="{{ asset('js/game.js') }}"></script>
@endpush
