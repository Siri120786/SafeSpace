/// Memory Match rules. Immutable: every move returns a new state.
library;

import 'dart:math';
import 'game_content.dart';

enum CardState { down, up, matched }

enum MemoryEvent { none, flip, match, miss, won }

class MemoryCard {
  final int index;
  final String pairId;
  final String face;
  final CardState state;
  const MemoryCard(this.index, this.pairId, this.face, this.state);

  MemoryCard withState(CardState s) => MemoryCard(index, pairId, face, s);
}

class MemoryState {
  final List<MemoryCard> cards;
  final int columns;
  final int totalPairs;
  final int matchedPairs;
  final int mistakes;
  final int flips;
  final int hints;

  /// True while two unmatched cards are showing; flip back with [resolveMismatch].
  final bool locked;
  final bool won;
  final MemoryEvent lastEvent;

  const MemoryState({
    required this.cards,
    required this.columns,
    required this.totalPairs,
    this.matchedPairs = 0,
    this.mistakes = 0,
    this.flips = 0,
    this.hints = 0,
    this.locked = false,
    this.won = false,
    this.lastEvent = MemoryEvent.none,
  });

  MemoryState copyWith({
    List<MemoryCard>? cards,
    int? matchedPairs,
    int? mistakes,
    int? flips,
    int? hints,
    bool? locked,
    bool? won,
    MemoryEvent? lastEvent,
  }) =>
      MemoryState(
        cards: cards ?? this.cards,
        columns: columns,
        totalPairs: totalPairs,
        matchedPairs: matchedPairs ?? this.matchedPairs,
        mistakes: mistakes ?? this.mistakes,
        flips: flips ?? this.flips,
        hints: hints ?? this.hints,
        locked: locked ?? this.locked,
        won: won ?? this.won,
        lastEvent: lastEvent ?? this.lastEvent,
      );

  int get pairsLeft => totalPairs - matchedPairs;
}

MemoryState newMemoryGame(GameContent content, Difficulty difficulty, Random rng, {String? themeId}) {
  final MemoryRules rules = content.memoryRules(difficulty);
  final List<MemoryTheme> themes = content.memoryThemes;
  MemoryTheme theme = themes[rng.nextInt(themes.length)];
  for (final MemoryTheme t in themes) {
    if (t.id == themeId) theme = t;
  }
  final List<String> faces = (List<String>.from(theme.cards)..shuffle(rng)).take(rules.pairs).toList();
  final List<String> deck = <String>[for (final String f in faces) ...<String>[f, f]]..shuffle(rng);
  return MemoryState(
    cards: <MemoryCard>[for (int i = 0; i < deck.length; i++) MemoryCard(i, deck[i], deck[i], CardState.down)],
    columns: rules.columns,
    totalPairs: rules.pairs,
  );
}

List<MemoryCard> _faceUp(MemoryState s) => s.cards.where((MemoryCard c) => c.state == CardState.up).toList();

/// Flips one card. Ignored while locked, finished, or for a card already showing.
MemoryState flipCard(MemoryState state, int index) {
  if (index < 0 || index >= state.cards.length) return state;
  final MemoryCard card = state.cards[index];
  if (state.locked || state.won || card.state != CardState.down) return state;

  final List<MemoryCard> cards = <MemoryCard>[
    for (final MemoryCard c in state.cards) c.index == index ? c.withState(CardState.up) : c,
  ];
  final MemoryState next = state.copyWith(cards: cards, flips: state.flips + 1, lastEvent: MemoryEvent.flip);
  final List<MemoryCard> open = _faceUp(next);
  if (open.length < 2) return next;

  final MemoryCard a = open[0];
  final MemoryCard b = open[1];
  if (a.pairId == b.pairId) {
    final List<MemoryCard> matched = <MemoryCard>[
      for (final MemoryCard c in cards) (c.index == a.index || c.index == b.index) ? c.withState(CardState.matched) : c,
    ];
    final int matchedPairs = state.matchedPairs + 1;
    final bool won = matchedPairs == state.totalPairs;
    return next.copyWith(
      cards: matched,
      matchedPairs: matchedPairs,
      won: won,
      lastEvent: won ? MemoryEvent.won : MemoryEvent.match,
    );
  }
  return next.copyWith(mistakes: state.mistakes + 1, locked: true, lastEvent: MemoryEvent.miss);
}

/// Turns the two showing cards back over after a miss.
MemoryState resolveMismatch(MemoryState state) {
  if (!state.locked) return state;
  return state.copyWith(
    cards: <MemoryCard>[for (final MemoryCard c in state.cards) c.state == CardState.up ? c.withState(CardState.down) : c],
    locked: false,
  );
}

class HintResult {
  final MemoryState state;
  final List<int>? pair;
  const HintResult(this.state, this.pair);
}

/// Two card positions that match, to point at. Costs a hint.
HintResult hintPair(MemoryState state) {
  if (state.locked || state.won) return HintResult(state, null);
  final List<MemoryCard> hidden = state.cards.where((MemoryCard c) => c.state == CardState.down).toList();
  final List<MemoryCard> showing = _faceUp(state);
  List<int>? pair;
  if (showing.isNotEmpty) {
    for (final MemoryCard c in hidden) {
      if (c.pairId == showing.first.pairId) {
        pair = <int>[showing.first.index, c.index];
        break;
      }
    }
  }
  if (pair == null && hidden.isNotEmpty) {
    final MemoryCard first = hidden.first;
    for (final MemoryCard c in hidden) {
      if (c.pairId == first.pairId && c.index != first.index) {
        pair = <int>[first.index, c.index];
        break;
      }
    }
  }
  if (pair == null) return HintResult(state, null);
  return HintResult(state.copyWith(hints: state.hints + 1), pair);
}
