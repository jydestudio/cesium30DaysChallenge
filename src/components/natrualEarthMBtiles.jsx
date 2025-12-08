import React, { useState } from 'react';

const NaturalEarthMBtiles = ({map}) => {
  const [isLoaded, setIsLoaded] = useState(true);

  return (
    
    <div className="p-6 bg-gray-100 rounded-lg shadow-md max-w-md mx-auto mt-10">
      {isLoaded ? (
        <p className="text-green-600 font-bold text-lg">
          Natural Earth MBTiles layer loaded successfully.
        </p>
      ) : (
        <p className="text-blue-600 font-medium text-lg animate-pulse">
          Loading Natural Earth MBTiles layer...
        </p>
      )}

      <button
        onClick={() => setIsLoaded(!isLoaded)}
        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
      >
        Toggle Load State
      </button>


      <h1> i can show the world</h1>

    </div>
  );
};

export default NaturalEarthMBtiles;
