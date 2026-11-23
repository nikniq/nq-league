<?php

namespace App\Http\Controllers;

use App\Models\GameMatch;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class GameController extends Controller
{
    public const CHAMPIONS = ['vanguard', 'arcanist', 'ranger'];

    public function home()
    {
        $leaders = $this->rankings()->limit(5)->get();

        $recent = GameMatch::latest()->limit(8)->get();

        $stats = [
            'matches' => GameMatch::count(),
            'players' => GameMatch::distinct('player_name')->count('player_name'),
            'kills' => (int) GameMatch::sum('kills'),
        ];

        return view('home', compact('leaders', 'recent', 'stats'));
    }

    public const SORTS = ['wins' => 'Wins', 'winrate' => 'Win rate', 'kills' => 'Kills', 'kda' => 'K/D'];

    public const PERIODS = ['all' => 'All time', 'month' => 'This month', 'week' => 'This week'];

    public function leaderboard(Request $request)
    {
        $filters = $request->validate([
            'sort' => ['nullable', 'in:'.implode(',', array_keys(self::SORTS))],
            'champion' => ['nullable', 'in:'.implode(',', self::CHAMPIONS)],
            'period' => ['nullable', 'in:'.implode(',', array_keys(self::PERIODS))],
        ]) + ['sort' => 'wins', 'champion' => null, 'period' => 'all'];

        $rows = $this->rankings($filters['sort'], $filters['champion'], $filters['period'])->limit(100)->get();

        return view('leaderboard', [
            'rows' => $rows,
            'filters' => $filters,
            'sorts' => self::SORTS,
            'periods' => self::PERIODS,
            'champions' => self::CHAMPIONS,
        ]);
    }

    /**
     * Per-player aggregate standings. Win rate ranking requires at least 3 games so one lucky win cannot top it.
     */
    private function rankings(string $sort = 'wins', ?string $champion = null, string $period = 'all'): Builder
    {
        $query = GameMatch::query()
            ->select('player_name',
                DB::raw('SUM(victory) as wins'),
                DB::raw('COUNT(*) as games'),
                DB::raw('SUM(kills) as kills'),
                DB::raw('SUM(deaths) as deaths'),
                DB::raw('MAX(level) as best_level'),
                DB::raw('ROUND(100.0 * SUM(victory) / COUNT(*)) as winrate'),
                DB::raw('1.0 * SUM(kills) / CASE WHEN SUM(deaths) = 0 THEN 1 ELSE SUM(deaths) END as kda'))
            ->when($champion, fn (Builder $q) => $q->where('champion', $champion))
            ->when($period === 'week', fn (Builder $q) => $q->where('created_at', '>=', now()->subWeek()))
            ->when($period === 'month', fn (Builder $q) => $q->where('created_at', '>=', now()->subMonth()))
            ->groupBy('player_name');

        return match ($sort) {
            'winrate' => $query->havingRaw('COUNT(*) >= 3')->orderByDesc('winrate')->orderByDesc('games'),
            'kills' => $query->orderByDesc('kills')->orderBy('games'),
            'kda' => $query->orderByDesc('kda')->orderByDesc('kills'),
            default => $query->orderByDesc('wins')->orderBy('games'),
        };
    }

    public function play(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:24'],
            'champion' => ['required', 'in:'.implode(',', self::CHAMPIONS)],
        ]);

        return view('play', $data);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'player_name' => ['required', 'string', 'max:24'],
            'champion' => ['required', 'in:'.implode(',', self::CHAMPIONS)],
            'victory' => ['required', 'boolean'],
            'kills' => ['required', 'integer', 'min:0', 'max:999'],
            'deaths' => ['required', 'integer', 'min:0', 'max:999'],
            'creep_score' => ['required', 'integer', 'min:0', 'max:9999'],
            'level' => ['required', 'integer', 'min:1', 'max:18'],
            'duration_seconds' => ['required', 'integer', 'min:0', 'max:86400'],
        ]);

        $match = GameMatch::create($data);

        return response()->json(['id' => $match->id], 201);
    }
}
