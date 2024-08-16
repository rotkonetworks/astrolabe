import { A } from "@solidjs/router";
import MapComponent from "~/components/MapComponent";

export default function Home() {
  return (
    <main class="text-center mx-auto text-gray-700">
      <MapComponent />
      <h1 class="max-6-xs text-6xl text-sky-700 font-thin uppercase my-16">
        <div class="flex justify-center items-center">
          <img class="w-12 h-12 mr-2" src="logo.png" alt="Astrolabe logo" />
          <span class="mr-5">Astrolabe</span>
        </div>
      </h1>
      <p class="my-4">
        <span>Home</span>
        {" - "}
        <A href="/about" class="text-sky-600 hover:underline">
          About
        </A>{" "}
      </p>
    </main>
  );
}
