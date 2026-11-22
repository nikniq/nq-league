<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\User as SocialiteUser;
use Tests\TestCase;

class GoogleAuthTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config(['services.google.client_id' => 'test-id', 'services.google.client_secret' => 'test-secret']);
    }

    public function test_google_routes_are_hidden_when_not_configured(): void
    {
        config(['services.google.client_id' => null]);

        $this->get(route('auth.google'))->assertNotFound();
        $this->get(route('login'))->assertDontSee(route('auth.google'));
    }

    public function test_login_page_shows_google_button_when_configured(): void
    {
        $this->get(route('login'))->assertOk()->assertSee(route('auth.google'));
    }

    public function test_redirect_sends_user_to_google(): void
    {
        Socialite::fake('google');

        $this->get(route('auth.google'))->assertRedirect();
    }

    public function test_callback_creates_and_signs_in_new_user(): void
    {
        Socialite::fake('google', SocialiteUser::fake(['id' => 'g-1', 'name' => 'Ada Lovelace', 'email' => 'ADA@example.com']));

        $this->get(route('auth.google.callback'))->assertRedirect(route('home'));

        $user = User::where('google_id', 'g-1')->firstOrFail();
        $this->assertSame('ada@example.com', $user->email);
        $this->assertSame('Ada Lovelace', $user->name);
        $this->assertNotNull($user->email_verified_at);
        $this->assertAuthenticatedAs($user);
    }

    public function test_callback_links_existing_account_by_email(): void
    {
        $existing = User::factory()->create(['email' => 'ada@example.com', 'name' => 'Ada']);
        Socialite::fake('google', SocialiteUser::fake(['id' => 'g-2', 'email' => 'ada@example.com']));

        $this->get(route('auth.google.callback'))->assertRedirect(route('home'));

        $this->assertSame('g-2', $existing->fresh()->google_id);
        $this->assertSame(1, User::count());
        $this->assertAuthenticatedAs($existing);
    }

    public function test_callback_gives_new_user_a_unique_name(): void
    {
        User::factory()->create(['name' => 'Test User']);
        Socialite::fake('google', SocialiteUser::fake(['id' => 'g-3', 'email' => 'other@example.com']));

        $this->get(route('auth.google.callback'));

        $this->assertSame('Test User 2', User::where('google_id', 'g-3')->value('name'));
    }

    public function test_callback_without_email_is_rejected(): void
    {
        Socialite::fake('google', SocialiteUser::fake(['email' => null]));

        $this->get(route('auth.google.callback'))->assertRedirect(route('login'))->assertSessionHasErrors('email');
        $this->assertGuest();
    }
}
