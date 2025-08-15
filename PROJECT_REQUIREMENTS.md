# Project Requirements Document: EVE Frontier Map Tool

## 1. Introduction

### 1.1 Purpose

The primary goal of this project is to develop a web-based, GPU-accelerated interactive map tool for the game EVE Frontier. This tool aims to enhance player gameplay by providing advanced routing capabilities and map visualization beyond what is available in the in-game client.

Specifically, the tool will address the following problems:

*   **Enhanced Map Visualization:** Present the EVE Frontier map data in a browser, allowing users to zoom, pan, and rotate the universe. It will display all solar systems and their stargate connections (represented as lines).
*   **Efficient Point-to-Point Routing:** Enable users to input a start and destination solar system and generate an efficient route. The routing algorithm will prioritize stargate travel over "jumping the gap" between stars and will account for a user-specified ship jump range.
*   **Region-Wide Exploration Routing:** Generate an efficient route to visit every solar system within a specified region ID. This route will also respect the user's jump range and prioritize stargate connections.
*   **"Bubble" Exploration Routing:** Allow users to specify a starting solar system and a maximum radius (e.g., 15 light-years) to define a "bubble." The tool will then find all systems within this range and generate the most efficient route to travel between all of them. It will also display the total number of jumps and the total distance in light-years (requiring conversion from meters in the raw data).
*   **In-Game Route Export:** Provide a mechanism to copy the names of solar systems along a generated route into a format suitable for pasting into the EVE Frontier game client (e.g., a small note).

### 1.2 Scope

**Inclusions:**
*   Interactive 3D map visualization (zoom, pan, rotate).
*   Display of solar systems, constellations, regions, and stargate connections.
*   Point-to-point route generation with jump range and stargate prioritization.
*   Region-wide exploration route generation.
*   "Bubble" exploration route generation with distance and jump count display.
*   Distance conversion from meters to light-years.
*   Route export functionality (copy system names).
*   Flagging of solar systems with only one planet (as these may present in-game issues).
*   Integration of Smartgate information.
*   Character linking via E-Vault or MetaMask.
*   Solar system search functionality.
*   Interactive solar system details (name, planet count).
*   Client-side routing algorithms with quick and simulated annealing options.
*   Player overlay/marking system for solar systems.
*   Toggle options for various map elements (stargate lines, Smartgate links, user annotations, MPC stations).
*   Customizable color schemes for map elements and regions.

**Exclusions:**
*   (To be determined - currently focusing on inclusions)

### 1.3 Definitions/Acronyms

*   **EVE Frontier:** The space-based game from which map data is sourced.
*   **Solar System:** A single star system within the game's universe.
*   **Constellation:** A grouping of solar systems.
*   **Region:** A larger grouping of constellations.
*   **Stargate:** In-game structures that allow instant travel between connected solar systems.
*   **Smart Gate:** Player-created gates (currently not in the map data; will require separate data integration if included).
*   **E-Vault/MetaMask:** Blockchain-based authentication methods for linking character data.
*   **MPC Station:** Non-Player Character Station, a type of in-game structure.

## 2. Overall Description

### 2.1 Product Perspective

This project will result in a **standalone, web-based application**. It is intended to be hosted on Netlify.

### 2.2 Product Functions

The application will perform the following key functions:
*   Visualize the EVE Frontier map with interactive controls (zoom, pan, rotate).
*   Display solar systems, constellations, regions, and their interconnections (stargates).
*   Provide search capabilities for solar systems, constellations, and regions.
*   Generate and display efficient routes based on user input (point-to-point, region-wide, bubble).
*   Calculate and display total jumps and total distance (in light-years) for generated routes.
*   Convert raw distance data (in meters) to light-years for display.
*   Allow users to copy generated route system names for in-game use.
*   Identify and flag solar systems that contain only one planet.
*   Integrate and display Smartgate information from external sources (MUD tables, Swagger API).
*   Allow character linking to display relevant in-game information.
*   Provide a player overlay/marking system for solar systems, allowing local saving of notes and color coding.
*   Implement client-side routing algorithms, including a quick initial route finder (ToOpt, NextNeighbor) and an optional, more intensive simulated annealing algorithm with user-configurable passes, CPU core utilization, and temperature adjustment.
*   Provide toggles for various map elements (stargate lines, Smartgate links, user annotations, MPC stations).
*   Allow customization of map element colors and region coloring.

### 2.3 User Characteristics

The primary users of this application will be **EVE Frontier players**. They are end-users seeking to enhance their gameplay experience through advanced map and routing features. Users are assumed to have a decent desktop CPU and GPU, as these are prerequisites for playing the game itself.

### 2.4 General Constraints

There are no explicit limitations or constraints identified at this time, other than the assumption of user hardware capabilities to support GPU-accelerated rendering.

## 3. Specific Requirements

### 3.1 Functional Requirements

*   **Map Display:** The system shall display the full EVE Frontier universe map, including all solar systems and their Stargate connections.
*   **Smartgate Integration:** The system shall integrate and display Smartgate information, sourced from game MUD tables or a Swagger API.
*   **Character Linking:** The system shall allow linking a user's EVE Frontier character to the map information using E-Vault or MetaMask for authentication.
*   **Solar System Search:** The system shall provide a search function to quickly locate specific solar systems.
*   **Solar System Details:** The system shall allow users to click on a solar system to view its name and a pop-up displaying the number of planets within that system.
*   **Routing - Point-to-Point:** The system shall generate the most efficient route between a user-specified start and destination solar system.
*   **Routing - Region Exploration:** The system shall generate the most efficient route to visit every solar system within a user-specified region ID.
*   **Routing - Bubble Exploration:** The system shall generate the most efficient route to visit all solar systems within a user-specified radius from a starting solar system.
*   **Routing Preferences:** The system shall allow users to specify routing preferences, including:
    *   Prioritization of jumps, Stargates, or Smartgates.
    *   A maximum jump range for their spaceship.
*   **Route Visualization:** The system shall display the generated route clearly on the map.
*   **Route Export:** The system shall allow users to copy the generated route (list of solar system names) as a note, suitable for pasting into the EVE Frontier game client.
*   **Player Overlay/Marking System:** The system shall enable users to:
    *   Mark solar systems with a chosen color.
    *   Add custom text notes to solar systems.
    *   Save these markings and notes locally on the client's machine.
*   **Routing Algorithm Execution:** The routing algorithms shall run client-side.
*   **Quick Route Finding:** The system shall provide an initial quick route finding option (e.g., using ToOpt and NextNeighbor algorithms).
*   **Simulated Annealing Routing:** The system shall offer an advanced simulated annealing route finding option, allowing users to:
    *   Specify the number of passes across multiple CPU cores.
    *   Pick a champion route from each pass.
    *   Specify the number of times per pass.
    *   Adjust the temperature for the simulated annealing process.
*   **Share Marked Information (Nice-to-Have):** The system should ideally provide a mechanism to share marked solar system information with other users.
*   **Stargate Line Toggle:** The system shall allow users to toggle the visibility of stargate connection lines.
*   **Region Highlighting:** The system shall allow users to search for a specific region and highlight its stars and gate links in a distinct color.
*   **MPC Station Toggle:** The system shall provide a toggle to show/hide systems containing MPC stations.
*   **Smartgate Link Toggle:** The system shall allow users to toggle the visibility of Smartgate links. Smartgate links shall be visually distinct (e.g., different color) from Stargate links.
*   **Usable Smartgate Toggle:** The system shall provide toggles to show/hide Smartgates based on user usability (determined by EVE Vault/MetaMask login). Route planning shall only consider usable Smartgates.
*   **User Annotation Toggle:** The system shall allow users to toggle the visibility of all user-created annotations (color marks and text notes).
*   **Color Customization:** The system shall allow users to customize the colors of:
    *   Stargate links
    *   Smartgate links
    *   Default star color
    *   Background color
*   **Region Coloring:** The system shall provide a facility to color regions with contrasting colors for adjacent regions, enabling single-click coloring of stars by region for visual analysis of region size.

### 3.2 Non-Functional Requirements

*   **Performance:** The map visualization shall render smoothly at 60 frames per second on a typical desktop GPU.
*   **Usability/Consistency:** The user interface shall adopt themes similar to the in-game client to ensure consistency and familiarity for EVE Frontier players.

## 4. Data Model

*   **Primary Data Source:** `map_data.json` will serve as the primary source for static map data (regions, constellations, solar systems, stargates).
    *   **Loading Strategy:** The optimal strategy for loading `map_data.json` (e.g., single file load on first visit vs. breaking down into smaller, on-demand files) will be determined during the implementation phase based on performance testing.
*   **Smartgate Data:** Smartgate information will be integrated from an external, yet-to-be-determined source (e.g., game MUD tables, Swagger API) as an additive layer to the primary map data.
*   **Local User Data:** Player-created markings and notes will be stored locally on the client's machine.

## 5. Technical Architecture (High-Level)

*   **Frontend:**
    *   **Framework:** **React** will be used for building the user interface due to its component-based architecture, strong community support, and suitability for complex interactive applications.
    *   **3D Rendering:** **Three.js** will be utilized for the GPU-accelerated 3D map visualization, leveraging its extensive features for rendering and interaction.
    *   **Language:** **TypeScript** will be employed for enhanced code quality, maintainability, and developer experience through static typing.
    *   **Build Tool:** **Vite** will be used for fast development and optimized production builds.
*   **Backend:** The initial version of the application will be primarily **client-side**. Features requiring data persistence, user authentication beyond E-Vault/MetaMask, or collaborative intelligence sharing (e.g., sharing marked overlays) will necessitate a backend service in future iterations.
*   **Hosting:** The application will be hosted on **Netlify**.

## 6. Future Enhancements

*   **Fuel Consumption Calculation:** Integrate calculations for fuel consumption along a generated route.
*   **Dynamic Region Coloring:** Ability to color different regions of space based on external data, such as Smartgate deployment by various groups.
*   **Shared Intel Overlays:** Implement functionality for groups of players to share custom overlays and intelligence, potentially leveraging sign-in via EVE Wallet or MetaMask for group authentication.
*   **General Flexibility:** The project will remain open to incorporating additional enhancements as identified throughout development and user feedback.