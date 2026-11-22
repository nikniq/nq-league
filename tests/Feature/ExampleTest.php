<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExampleTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_application_returns_a_successful_response(): void
    {
        $this->get('/')->assertOk();
    }

    public function test_tag_manager_loads_only_in_production(): void
    {
        config(['services.gtm.id' => 'GTM-TEST123']);

        $this->get('/')->assertDontSee('GTM-TEST123');

        $this->app['env'] = 'production';
        $this->get('/')->assertSee('googletagmanager.com/gtm.js?id=GTM-TEST123', false);
    }
}
