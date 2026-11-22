<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover@yield('viewport-extra')">
    <meta name="theme-color" content="#0a0f1a">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <meta name="description" content="Nexus Quest League – a free 3v3 battle arena you play right in your browser. No download, desktop and mobile.">
    <title>@yield('title', config('app.name'))</title>
    <link rel="stylesheet" href="{{ asset('css/game.css') }}?v={{ filemtime(public_path('css/game.css')) }}">
</head>
<body class="@yield('body-class')">
    @unless (View::hasSection('bare'))
    <header class="site-head">
        <div class="wrap">
            <a href="{{ route('home') }}" class="brand"><span class="brand-mark">◆</span> Nexus Quest <b>League</b></a>
            <nav class="site-nav">
                <a href="{{ route('home') }}#features">Features</a>
                <a href="{{ route('home') }}#champions">Champions</a>
                <a href="{{ route('home') }}#leaderboard">Leaderboard</a>
            </nav>
            <div class="site-auth">
                @auth
                    <span class="who">
                        @if (auth()->user()->avatar)<img src="{{ auth()->user()->avatar }}" alt="" referrerpolicy="no-referrer">@endif
                        {{ auth()->user()->name }}
                    </span>
                    <form method="POST" action="{{ route('logout') }}">@csrf<button class="btn ghost sm">Log out</button></form>
                @else
                    <a href="{{ route('login') }}" class="btn ghost sm">Log in</a>
                    <a href="{{ route('register') }}" class="btn sm">Register</a>
                @endauth
            </div>
        </div>
    </header>
    @endunless

    @yield('content')

    @unless (View::hasSection('bare'))
    <footer class="site-foot">
        <div class="wrap cols">
            <div>
                <a href="{{ route('home') }}" class="brand"><span class="brand-mark">◆</span> Nexus Quest <b>League</b></a>
                <p class="small">Free-to-play 3v3 battle arena in your browser. No download, no pay-to-win.</p>
            </div>
            <div>
                <h4>Play</h4>
                <a href="{{ route('home') }}#champions">Pick a champion</a>
                <a href="{{ route('home') }}#leaderboard">Leaderboard</a>
                <a href="{{ route('home') }}#faq">FAQ</a>
            </div>
            <div>
                <h4>Account</h4>
                @auth
                    <span class="small">Signed in as {{ auth()->user()->name }}</span>
                @else
                    <a href="{{ route('login') }}">Log in</a>
                    <a href="{{ route('register') }}">Create account</a>
                @endauth
            </div>
            <div>
                <h4>Network</h4>
                <a href="https://nikniq.com" rel="noopener">nikniq.com</a>
            </div>
        </div>
        <div class="wrap copy small">© {{ date('Y') }} Nexus Quest League. All rights reserved.</div>
    </footer>
    @endunless
    @stack('scripts')
</body>
</html>
