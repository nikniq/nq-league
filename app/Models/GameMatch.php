<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class GameMatch extends Model
{
    protected $fillable = [
        'player_name', 'champion', 'victory', 'kills', 'deaths',
        'creep_score', 'level', 'duration_seconds',
    ];

    protected $casts = ['victory' => 'boolean'];
}
