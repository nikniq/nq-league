<?php

use App\Http\Controllers\GameController;
use Illuminate\Support\Facades\Route;

Route::get('/', [GameController::class, 'home'])->name('home');
Route::get('/play', [GameController::class, 'play'])->name('play');
Route::post('/matches', [GameController::class, 'store'])->middleware('throttle:20,1')->name('matches.store');
