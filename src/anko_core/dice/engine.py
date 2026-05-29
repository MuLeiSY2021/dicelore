"""Dice calculation engine — pure functions, no MCP dependency."""

from __future__ import annotations

import random
import re
from dataclasses import dataclass


@dataclass
class DiceResult:
    """Result of a dice roll."""

    expression: str
    rolls: list[int]
    modifier: int
    total: int


_DICE_PATTERN = re.compile(r"^(\d+)[dD](\d+)([+-]\d+)?$")


def dice_roll(expression: str) -> DiceResult:
    """Roll dice using NdS[+M] syntax.

    Examples: 1d20, 2d6+3, 1d100, 1D20-2
    """
    match = _DICE_PATTERN.match(expression)
    if not match:
        raise ValueError(f"Invalid dice expression: {expression}")

    count = int(match.group(1))
    sides = int(match.group(2))
    modifier = int(match.group(3)) if match.group(3) else 0

    if count < 1:
        raise ValueError(f"Number of dice must be at least 1, got {count}")
    if sides < 2:
        raise ValueError(f"Number of sides must be at least 2, got {sides}")

    rolls = [random.randint(1, sides) for _ in range(count)]
    total = sum(rolls) + modifier

    return DiceResult(
        expression=expression,
        rolls=rolls,
        modifier=modifier,
        total=total,
    )
