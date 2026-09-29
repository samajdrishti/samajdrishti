import React, {
  createContext, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { io } from 'socket.io-client';
import { BACKEND_ORIGIN, getToken, getStoredUser } from './api';

const RealtimeContext = createContext(null);

/**
 * Single socket.io connection for the whole app. The JWT is sent in the handshake
 * so the server can join this user to their personal notification room.
 */
export const RealtimeProvider = ({ children }) => {
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState([]);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const token = getToken();
    if (!token) return undefined;

    const client = io(BACKEND_ORIGIN, {
      transports: ['websocket', 'polling'],
      auth: { token },
    });

    client.on('connect', () => {
      setConnected(true);
      const user = getStoredUser();
      if (user && user.id) client.emit('join', user.id);
    });
    client.on('disconnect', () => setConnected(false));

    const push = (type) => (payload) => {
      setEvents((current) => [{ id: `${type}-${Date.now()}`, type, payload, at: Date.now() }, ...current].slice(0, 25));
    };

    client.on('notification', push('notification'));
    client.on('alert', push('alert'));
    client.on('inspection:new', push('inspection'));
    client.on('inspection:update', push('inspection'));
    client.on('vc:invite', push('vc'));
    client.on('monitoring:tick', push('monitoring'));

    setSocket(client);
    return () => {
      client.removeAllListeners();
      client.close();
    };
  }, []);

  const value = useMemo(
    () => ({ connected, events, socket, clearEvents: () => setEvents([]) }),
    [connected, events, socket]
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
};

export const useRealtime = () => {
  const context = useContext(RealtimeContext);
  if (!context) throw new Error('useRealtime must be used inside RealtimeProvider');
  return context;
};

/** Subscribe to the newest realtime event of a given type. */
export const useRealtimeEvent = (type, handler) => {
  const { events } = useRealtime();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  const latest = useMemo(() => events.find((e) => e.type === type), [events, type]);

  useEffect(() => {
    if (latest && handlerRef.current) handlerRef.current(latest.payload, latest);
  }, [latest]);
};

export default RealtimeContext;
