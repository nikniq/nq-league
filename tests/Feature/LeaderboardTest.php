<?php

namespace Tests\Feature;

use App\Models\GameMatch;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LeaderboardTest extends TestCase
{
    use RefreshDatabase;

    private function recordMatch(string $name, bool $victory, int $kills = 3, int $deaths = 2, string $champion = 'ranger'): void
    {
        GameMatch::create([
            'player_name' => $name, 'champion' => $champion, 'victory' => $victory,
            'kills' => $kills, 'deaths' => $deaths, 'creep_score' => 50, 'level' => 10, 'duration_seconds' => 600,
        ]);
    }

    public function test_leaderboard_page_ranks_players_by_wins(): void
    {
        $this->recordMatch('Alpha', true);
        $this->recordMatch('Bravo', true);
        $this->recordMatch('Bravo', true);

        $this->get(route('leaderboard'))
            ->assertOk()
            ->assertSeeInOrder(['Bravo', 'Alpha']);
    }

    public function test_win_rate_ranking_requires_three_games(): void
    {
        $this->recordMatch('Lucky', true);
        foreach ([true, true, false] as $won) {
            $this->recordMatch('Steady', $won);
        }

        $this->get(route('leaderboard', ['sort' => 'winrate']))
            ->assertOk()
            ->assertSee('Steady')
            ->assertDontSee('Lucky');
    }

    public function test_champion_filter_and_kd_sort(): void
    {
        $this->recordMatch('Mage', true, 10, 1, 'arcanist');
        $this->recordMatch('Archer', true, 20, 1, 'ranger');

        $this->get(route('leaderboard', ['champion' => 'arcanist', 'sort' => 'kda']))
            ->assertOk()
            ->assertSee('Mage')
            ->assertDontSee('Archer');
    }

    public function test_invalid_filter_is_rejected(): void
    {
        $this->get(route('leaderboard', ['sort' => 'bogus']))->assertRedirect();
    }

    public function test_home_links_to_full_leaderboard(): void
    {
        $this->get(route('home'))->assertOk()->assertSee(route('leaderboard'));
    }
}
