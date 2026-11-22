<?php

namespace App\Http\Controllers;

use App\Models\GameMatch;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class GameController extends Controller
{
    public const CHAMPIONS = ['vanguard', 'arcanist', 'ranger'];

    public function home()
    {
        $leaders = GameMatch::query()
            ->select('player_name',
                DB::raw('SUM(victory) as wins'),
                DB::raw('COUNT(*) as games'),
                DB::raw('SUM(kills) as kills'),
                DB::raw('SUM(deaths) as deaths'))
            ->groupBy('player_name')
            ->orderByDesc('wins')
            ->orderBy('games')
            ->limit(10)
            ->get();

        $recent = GameMatch::latest()->limit(8)->get();

        return view('home', compact('leaders', 'recent'));
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
