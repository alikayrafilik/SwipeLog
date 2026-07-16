#!/usr/bin/env node

const assert = require('node:assert/strict');
const { initializeApp, deleteApp } = require('firebase/app');
const {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  signOut,
} = require('firebase/auth');
const {
  connectFirestoreEmulator,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  setDoc,
  updateDoc,
  where,
} = require('firebase/firestore');

const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT || 'demo-swipelog';
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const [firestoreEmulatorHost, firestoreEmulatorPort] = firestoreHost.split(':');
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const listId = `qa-list-${runId}`;
const inviteCode = `QA${runId.slice(-6).toUpperCase()}`;
const ownerMovieId = `owner-movie-${runId}`;
const memberMovieId = `member-movie-${runId}`;
const now = () => new Date().toISOString();

const createClient = async (name) => {
  const app = initializeApp(
    {
      apiKey: 'demo-key',
      authDomain: `${projectId}.firebaseapp.com`,
      projectId,
      appId: `demo-${name}`,
    },
    `qa-${name}-${runId}`
  );
  const auth = getAuth(app);
  const firestore = getFirestore(app);
  connectAuthEmulator(auth, `http://${authHost}`, { disableWarnings: true });
  connectFirestoreEmulator(firestore, firestoreEmulatorHost, Number(firestoreEmulatorPort));
  const credential = await createUserWithEmailAndPassword(
    auth,
    `${name}-${runId}@example.test`,
    'Password123!'
  );
  return { app, auth, firestore, uid: credential.user.uid, name };
};

const createAnonymousFirestore = () => {
  const app = initializeApp(
    {
      apiKey: 'demo-key',
      authDomain: `${projectId}.firebaseapp.com`,
      projectId,
      appId: 'demo-anonymous',
    },
    `qa-anonymous-${runId}`
  );
  const firestore = getFirestore(app);
  connectFirestoreEmulator(firestore, firestoreEmulatorHost, Number(firestoreEmulatorPort));
  return { app, firestore };
};

const expectDenied = async (label, operation) => {
  try {
    await operation();
  } catch (error) {
    if (error?.code === 'permission-denied') return;
    throw error;
  }
  throw new Error(`Expected permission-denied: ${label}`);
};

const itemPayload = (movieId, user, title) => ({
  id: movieId,
  movieId,
  title,
  image: null,
  date: '2026',
  overview: 'QA movie',
  addedBy: user.uid,
  addedByName: user.name,
  addedAt: now(),
  status: 'candidate',
});

const main = async () => {
  const clients = [];
  const anonymous = createAnonymousFirestore();

  try {
    const owner = await createClient('owner');
    const member = await createClient('member');
    const outsider = await createClient('outsider');
    clients.push(owner, member, outsider);

    const friendRequestId = `${owner.uid}_${member.uid}`;
    const friendRequestRef = doc(owner.firestore, 'friend_requests', friendRequestId);
    await setDoc(friendRequestRef, {
      id: friendRequestId,
      fromUserId: owner.uid,
      fromDisplayName: 'Owner',
      fromUsername: `owner-${runId}`,
      fromAvatarUrl: null,
      fromAvatarIcon: 'sparkles',
      fromAvatarColor: '#F9C80E',
      toUserId: member.uid,
      toDisplayName: 'Member',
      toUsername: `member-${runId}`,
      toAvatarUrl: null,
      toAvatarIcon: 'film',
      toAvatarColor: '#071B2B',
      status: 'pending',
      createdAt: now(),
      updatedAt: now(),
    });
    assert.equal((await getDoc(friendRequestRef)).exists(), true);
    assert.equal(
      (await getDoc(doc(member.firestore, 'friend_requests', friendRequestId))).exists(),
      true
    );
    await expectDenied('unrelated users cannot read friend requests', () =>
      getDoc(doc(outsider.firestore, 'friend_requests', friendRequestId))
    );
    await expectDenied('signed-out users cannot read friend requests', () =>
      getDoc(doc(anonymous.firestore, 'friend_requests', friendRequestId))
    );
    const memberInbox = await getDocs(
      query(
        collection(member.firestore, 'friend_requests'),
        where('toUserId', '==', member.uid),
        where('status', '==', 'pending')
      )
    );
    assert.equal(memberInbox.size, 1);
    await expectDenied('users cannot list unrelated friend requests', () =>
      getDocs(collection(outsider.firestore, 'friend_requests'))
    );

    await updateDoc(doc(member.firestore, 'friend_requests', friendRequestId), {
      status: 'accepted',
      updatedAt: now(),
    });
    await setDoc(doc(member.firestore, 'user_friends', owner.uid, 'friends', member.uid), {
      userId: member.uid,
      displayName: 'Member',
      username: `member-${runId}`,
      avatarUrl: null,
      avatarIcon: 'film',
      avatarColor: '#071B2B',
      createdAt: now(),
    });
    await setDoc(doc(member.firestore, 'user_friends', member.uid, 'friends', owner.uid), {
      userId: owner.uid,
      displayName: 'Owner',
      username: `owner-${runId}`,
      avatarUrl: null,
      avatarIcon: 'sparkles',
      avatarColor: '#F9C80E',
      createdAt: now(),
    });
    await deleteDoc(doc(owner.firestore, 'user_friends', member.uid, 'friends', owner.uid));
    await deleteDoc(doc(owner.firestore, 'user_friends', owner.uid, 'friends', member.uid));
    await deleteDoc(friendRequestRef);

    const publicProfileRef = doc(owner.firestore, 'public_profiles', owner.uid);
    await setDoc(publicProfileRef, {
      userId: owner.uid,
      usernameKey: `owner-${runId}`,
    });
    await deleteDoc(publicProfileRef);
    assert.equal((await getDoc(publicProfileRef)).exists(), false);

    const ownerListRef = doc(owner.firestore, 'shared_watchlists', listId);
    await setDoc(ownerListRef, {
      name: 'QA Shared Watchlist',
      inviteCode,
      ownerId: owner.uid,
      createdAt: now(),
      updatedAt: now(),
      status: 'active',
    });
    await setDoc(doc(owner.firestore, 'shared_watchlists', listId, 'members', owner.uid), {
      userId: owner.uid,
      displayName: 'Owner',
      role: 'owner',
      joinedAt: now(),
      inviteCode,
    });
    await setDoc(doc(owner.firestore, 'shared_watchlist_invites', inviteCode), {
      code: inviteCode,
      listId,
      name: 'QA Shared Watchlist',
      ownerId: owner.uid,
      status: 'active',
      updatedAt: now(),
    });
    await setDoc(doc(owner.firestore, 'user_shared_watchlists', owner.uid, 'lists', listId), {
      listId,
      name: 'QA Shared Watchlist',
      inviteCode,
      ownerId: owner.uid,
      updatedAt: now(),
      status: 'active',
    });

    await expectDenied('signed-out users cannot read shared lists', () =>
      getDoc(doc(anonymous.firestore, 'shared_watchlists', listId))
    );
    await expectDenied('non-members cannot read shared lists', () =>
      getDoc(doc(outsider.firestore, 'shared_watchlists', listId))
    );

    const inviteSnapshot = await getDoc(doc(member.firestore, 'shared_watchlist_invites', inviteCode));
    assert.equal(inviteSnapshot.exists(), true);

    await setDoc(doc(member.firestore, 'shared_watchlists', listId, 'members', member.uid), {
      userId: member.uid,
      displayName: 'Member',
      role: 'member',
      joinedAt: now(),
      inviteCode,
    });
    await setDoc(doc(member.firestore, 'user_shared_watchlists', member.uid, 'lists', listId), {
      listId,
      name: 'QA Shared Watchlist',
      inviteCode,
      ownerId: owner.uid,
      updatedAt: now(),
      status: 'active',
    });
    await deleteDoc(doc(owner.firestore, 'user_shared_watchlists', member.uid, 'lists', listId));
    await setDoc(doc(member.firestore, 'user_shared_watchlists', member.uid, 'lists', listId), {
      listId,
      name: 'QA Shared Watchlist',
      inviteCode,
      ownerId: owner.uid,
      updatedAt: now(),
      status: 'active',
    });

    await setDoc(
      doc(owner.firestore, 'shared_watchlists', listId, 'items', ownerMovieId),
      itemPayload(ownerMovieId, owner, 'Owner Movie')
    );
    await setDoc(doc(member.firestore, 'shared_watchlists', listId, 'items', ownerMovieId, 'votes', member.uid), {
      userId: member.uid,
      vote: 'yes',
      updatedAt: now(),
    });

    await expectDenied('members cannot choose movies', () =>
      updateDoc(doc(member.firestore, 'shared_watchlists', listId, 'items', ownerMovieId), {
        status: 'chosen',
      })
    );
    await updateDoc(doc(owner.firestore, 'shared_watchlists', listId, 'items', ownerMovieId), {
      status: 'chosen',
    });
    await expectDenied('members cannot remove another member movie', () =>
      deleteDoc(doc(member.firestore, 'shared_watchlists', listId, 'items', ownerMovieId))
    );

    await setDoc(
      doc(member.firestore, 'shared_watchlists', listId, 'items', memberMovieId),
      itemPayload(memberMovieId, member, 'Member Movie')
    );
    await setDoc(doc(owner.firestore, 'shared_watchlists', listId, 'items', memberMovieId, 'votes', owner.uid), {
      userId: owner.uid,
      vote: 'maybe',
      updatedAt: now(),
    });
    await deleteDoc(doc(member.firestore, 'shared_watchlists', listId, 'items', memberMovieId, 'votes', owner.uid));
    await deleteDoc(doc(member.firestore, 'shared_watchlists', listId, 'items', memberMovieId));

    const archivedMemberMovieId = `archived-member-movie-${runId}`;
    await setDoc(
      doc(member.firestore, 'shared_watchlists', listId, 'items', archivedMemberMovieId),
      itemPayload(archivedMemberMovieId, member, 'Archived Member Movie')
    );
    await setDoc(
      doc(owner.firestore, 'shared_watchlists', listId, 'items', archivedMemberMovieId, 'votes', owner.uid),
      { userId: owner.uid, vote: 'yes', updatedAt: now() }
    );
    await setDoc(
      doc(owner.firestore, 'shared_watchlists', listId, 'items', archivedMemberMovieId, 'seenBy', owner.uid),
      {
        userId: owner.uid,
        displayName: 'Owner',
        avatarUrl: '',
        watchedAt: now(),
        updatedAt: now(),
        source: 'user_log',
      }
    );

    await updateDoc(ownerListRef, {
      status: 'archived',
      updatedAt: now(),
    });
    await updateDoc(doc(owner.firestore, 'shared_watchlist_invites', inviteCode), {
      status: 'archived',
      updatedAt: now(),
    });

    await expectDenied('archived lists reject new members', () =>
      setDoc(doc(outsider.firestore, 'shared_watchlists', listId, 'members', outsider.uid), {
        userId: outsider.uid,
        displayName: 'Outsider',
        role: 'member',
        joinedAt: now(),
        inviteCode,
      })
    );
    await expectDenied('archived lists reject votes', () =>
      setDoc(doc(member.firestore, 'shared_watchlists', listId, 'items', ownerMovieId, 'votes', member.uid), {
        userId: member.uid,
        vote: 'no',
        updatedAt: now(),
      })
    );
    await expectDenied('archived lists cannot be reactivated', () =>
      updateDoc(ownerListRef, {
        status: 'active',
        updatedAt: now(),
      })
    );
    await deleteDoc(
      doc(member.firestore, 'shared_watchlists', listId, 'items', archivedMemberMovieId, 'votes', owner.uid)
    );
    await deleteDoc(
      doc(member.firestore, 'shared_watchlists', listId, 'items', archivedMemberMovieId, 'seenBy', owner.uid)
    );
    await deleteDoc(doc(member.firestore, 'shared_watchlists', listId, 'items', archivedMemberMovieId));

    await deleteDoc(doc(member.firestore, 'shared_watchlists', listId, 'members', member.uid));
    await expectDenied('stale membership indexes cannot read private lists', () =>
      getDoc(doc(member.firestore, 'shared_watchlists', listId))
    );
    await deleteDoc(doc(member.firestore, 'user_shared_watchlists', member.uid, 'lists', listId));

    await deleteDoc(
      doc(owner.firestore, 'shared_watchlists', listId, 'items', ownerMovieId, 'votes', member.uid)
    );
    await deleteDoc(doc(owner.firestore, 'shared_watchlists', listId, 'items', ownerMovieId));
    await deleteDoc(doc(owner.firestore, 'user_shared_watchlists', owner.uid, 'lists', listId));
    await deleteDoc(doc(owner.firestore, 'shared_watchlists', listId, 'members', owner.uid));
    await deleteDoc(doc(owner.firestore, 'shared_watchlist_invites', inviteCode));
    await deleteDoc(ownerListRef);

    await Promise.all(clients.map((client) => signOut(client.auth)));
    console.log('Shared watchlist emulator QA passed.');
  } finally {
    await Promise.allSettled(clients.map((client) => deleteApp(client.app)));
    await deleteApp(anonymous.app).catch(() => undefined);
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
